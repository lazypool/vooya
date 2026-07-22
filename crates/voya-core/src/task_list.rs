use std::collections::HashSet;

use wasm_bindgen::{JsCast, JsValue, closure::Closure, prelude::wasm_bindgen};
use web_sys::{Element, Event, HtmlElement, HtmlInputElement};

use crate::{Effect, effect, signal};

#[derive(Clone)]
struct Task {
    id: u32,
    label: String,
    done: bool,
}

#[derive(Clone, Copy, PartialEq)]
enum Filter {
    All,
    Active,
    Done,
}

impl Filter {
    fn matches(self, task: &Task) -> bool {
        match self {
            Self::All => true,
            Self::Active => !task.done,
            Self::Done => task.done,
        }
    }
}

#[wasm_bindgen]
pub struct TaskListHandle {
    root: Element,
    // Retained for the lifetime of the island so browser listeners remain live.
    _handlers: Vec<Closure<dyn FnMut(Event)>>,
    _render: Effect,
}

#[wasm_bindgen]
impl TaskListHandle {
    pub fn dispose(&mut self) {
        self.root.remove();
    }
}

#[wasm_bindgen]
pub fn mount_task_list(host: Element) -> Result<TaskListHandle, JsValue> {
    let document = host
        .owner_document()
        .ok_or_else(|| JsValue::from_str("Voya mount host has no document"))?;
    let root = document.create_element("section")?;
    root.set_class_name("voya-task-list");
    root.set_attribute("data-voya-island", "task-list")?;
    root.set_inner_html(
        r#"
        <div class="voya-task-compose">
          <input data-voya-task-input aria-label="New task" placeholder="Add a task">
          <button data-voya-add>Add task</button>
        </div>
        <p data-voya-error role="alert"></p>
        <div class="voya-task-filters">
          <button data-voya-filter="all">All</button>
          <button data-voya-filter="active">Active</button>
          <button data-voya-filter="done">Done</button>
        </div>
        <p data-voya-summary></p>
        <p data-voya-empty hidden>No tasks in this view.</p>
        <div data-voya-task-rows></div>
        "#,
    );
    host.append_child(&root)?;

    let tasks = signal(vec![
        Task {
            id: 1,
            label: "Design the island boundary".into(),
            done: true,
        },
        Task {
            id: 2,
            label: "Measure a real workload".into(),
            done: true,
        },
        Task {
            id: 3,
            label: "Build a reusable component model".into(),
            done: false,
        },
    ]);
    let filter = signal(Filter::All);
    let error = signal(None::<String>);
    let next_id = signal(4_u32);

    let render_root = root.clone();
    let render_tasks = tasks.clone();
    let render_filter = filter.clone();
    let render_error = error.clone();
    let render = effect(move || {
        render_task_list(
            &render_root,
            &render_tasks.get(),
            render_filter.get(),
            render_error.get().as_deref(),
        )
    });
    tasks.subscribe(render.clone());
    filter.subscribe(render.clone());
    error.subscribe(render.clone());
    render();

    let input: HtmlInputElement = root
        .query_selector("[data-voya-task-input]")?
        .ok_or_else(|| JsValue::from_str("Voya task input is missing"))?
        .dyn_into()?;
    let add: HtmlElement = root
        .query_selector("[data-voya-add]")?
        .ok_or_else(|| JsValue::from_str("Voya add task button is missing"))?
        .dyn_into()?;
    let add_input = input.clone();
    let add_tasks = tasks.clone();
    let add_error = error.clone();
    let add_next_id = next_id.clone();
    let add_handler = Closure::new(move |_event: Event| {
        let label = add_input.value().trim().to_owned();
        if label.is_empty() {
            add_error.set(Some("A task needs a label.".into()));
            return;
        }
        let id = add_next_id.get();
        add_next_id.set(id + 1);
        add_tasks.update(|tasks| {
            tasks.push(Task {
                id,
                label,
                done: false,
            })
        });
        add_error.set(None);
        add_input.set_value("");
    });
    add.add_event_listener_with_callback("click", add_handler.as_ref().unchecked_ref())?;

    let click_tasks = tasks.clone();
    let click_filter = filter.clone();
    let click_handler = Closure::new(move |event: Event| {
        let Some(target) = event
            .target()
            .and_then(|target| target.dyn_into::<Element>().ok())
        else {
            return;
        };
        if let Some(value) = target.get_attribute("data-voya-filter") {
            let next = match value.as_str() {
                "active" => Filter::Active,
                "done" => Filter::Done,
                _ => Filter::All,
            };
            click_filter.set(next);
            return;
        }
        let Some(action) = target.get_attribute("data-voya-task-action") else {
            return;
        };
        let Some(id) = target
            .get_attribute("data-voya-task-id")
            .and_then(|value| value.parse::<u32>().ok())
        else {
            return;
        };
        click_tasks.update(|tasks| match action.as_str() {
            "toggle" => {
                if let Some(task) = tasks.iter_mut().find(|task| task.id == id) {
                    task.done = !task.done;
                }
            }
            "remove" => tasks.retain(|task| task.id != id),
            _ => {}
        });
    });
    root.add_event_listener_with_callback("click", click_handler.as_ref().unchecked_ref())?;

    Ok(TaskListHandle {
        root,
        _handlers: vec![add_handler, click_handler],
        _render: render,
    })
}

fn render_task_list(root: &Element, tasks: &[Task], filter: Filter, error: Option<&str>) {
    let visible = tasks
        .iter()
        .filter(|task| filter.matches(task))
        .cloned()
        .collect::<Vec<_>>();
    if let Ok(Some(summary)) = root.query_selector("[data-voya-summary]") {
        summary.set_text_content(Some(&format!(
            "{} of {} tasks shown",
            visible.len(),
            tasks.len()
        )));
    }
    if let Ok(Some(error_node)) = root.query_selector("[data-voya-error]") {
        error_node.set_text_content(error);
    }
    if let Ok(Some(empty)) = root.query_selector("[data-voya-empty]") {
        if visible.is_empty() {
            let _ = empty.remove_attribute("hidden");
        } else {
            let _ = empty.set_attribute("hidden", "");
        }
    }
    let Ok(Some(rows)) = root.query_selector("[data-voya-task-rows]") else {
        return;
    };
    let Some(document) = root.owner_document() else {
        return;
    };
    let visible_ids = visible.iter().map(|task| task.id).collect::<HashSet<_>>();
    for task in &visible {
        let selector = format!("[data-voya-key=\"{}\"]", task.id);
        let row = rows
            .query_selector(&selector)
            .ok()
            .flatten()
            .unwrap_or_else(|| {
                let row = document.create_element("div").unwrap();
                row.set_class_name("voya-task-row");
                let _ = row.set_attribute("data-voya-key", &task.id.to_string());
                row
            });
        row.set_class_name(if task.done {
            "voya-task-row is-done"
        } else {
            "voya-task-row"
        });
        row.set_text_content(None);
        let label = document.create_element("span").unwrap();
        label.set_text_content(Some(&task.label));
        let toggle = document.create_element("button").unwrap();
        let _ = toggle.set_attribute("data-voya-task-action", "toggle");
        let _ = toggle.set_attribute("data-voya-task-id", &task.id.to_string());
        toggle.set_text_content(Some(if task.done { "Undo" } else { "Done" }));
        let remove = document.create_element("button").unwrap();
        let _ = remove.set_attribute("data-voya-task-action", "remove");
        let _ = remove.set_attribute("data-voya-task-id", &task.id.to_string());
        remove.set_text_content(Some("Remove"));
        let _ = row.append_child(&label);
        let _ = row.append_child(&toggle);
        let _ = row.append_child(&remove);
        let _ = rows.append_child(&row);
    }
    let existing = rows.children();
    for index in (0..existing.length()).rev() {
        if let Some(row) = existing.item(index) {
            let keep = row
                .get_attribute("data-voya-key")
                .and_then(|id| id.parse::<u32>().ok())
                .is_some_and(|id| visible_ids.contains(&id));
            if !keep {
                row.remove();
            }
        }
    }
}
