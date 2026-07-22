use std::{cell::RefCell, rc::Rc};

use wasm_bindgen::{JsCast, JsValue, closure::Closure, prelude::wasm_bindgen};
use web_sys::{Element, Event, HtmlElement, HtmlInputElement};

const ROW_HEIGHT: i32 = 28;
const WINDOW_SIZE: usize = 24;
const BENCHMARK_ROUNDS: usize = 20;
const BENCHMARK_QUERIES: [&str; 20] = [
    "item-000", "item-001", "item-010", "item-011", "item-020", "item-021", "item-030", "item-031",
    "item-040", "item-041", "item-050", "item-051", "item-060", "item-061", "item-070", "item-071",
    "item-080", "item-081", "item-090", "item-091",
];

struct Row {
    id: usize,
    name: String,
    score: u32,
}

struct GridState {
    rows: Vec<Row>,
    visible: Vec<usize>,
    query: String,
    descending: bool,
    start: usize,
    selected: Option<usize>,
    benchmark: Option<(f64, f64)>,
}

impl GridState {
    fn new(row_count: usize) -> Self {
        let rows = (0..row_count)
            .map(|id| Row {
                id,
                name: format!("item-{id:06}"),
                score: ((id as u32).wrapping_mul(17)) % 100_003,
            })
            .collect::<Vec<_>>();
        let visible = (0..rows.len()).collect();
        let mut state = Self {
            rows,
            visible,
            query: String::new(),
            descending: false,
            start: 0,
            selected: None,
            benchmark: None,
        };
        state.refresh();
        state
    }

    fn refresh(&mut self) {
        self.visible = self
            .rows
            .iter()
            .filter(|row| row.name.contains(&self.query))
            .map(|row| row.id)
            .collect();
        self.visible.sort_unstable_by_key(|id| self.rows[*id].score);
        if self.descending {
            self.visible.reverse();
        }
        self.start = self.start.min(self.visible.len().saturating_sub(1));
    }
}

#[wasm_bindgen]
pub struct DataGridHandle {
    root: Element,
    state: Rc<RefCell<GridState>>,
    // Retained for the lifetime of the island so browser listeners remain live.
    _handlers: Vec<Closure<dyn FnMut(Event)>>,
}

#[wasm_bindgen]
impl DataGridHandle {
    pub fn update_filter(&self, query: String) {
        let mut state = self.state.borrow_mut();
        state.query = query;
        state.refresh();
        render(&self.root, &state);
    }

    pub fn toggle_sort(&self) {
        let mut state = self.state.borrow_mut();
        state.descending = !state.descending;
        state.refresh();
        render(&self.root, &state);
    }

    pub fn scroll_to(&self, row: usize) {
        let mut state = self.state.borrow_mut();
        state.start = row.min(state.visible.len().saturating_sub(1));
        render(&self.root, &state);
    }

    pub fn dispose(&mut self) {
        self.root.remove();
    }
}

#[wasm_bindgen]
pub fn mount_data_grid(host: Element, row_count: usize) -> Result<DataGridHandle, JsValue> {
    let document = host
        .owner_document()
        .ok_or_else(|| JsValue::from_str("Voya mount host has no document"))?;
    let root = document.create_element("section")?;
    root.set_class_name("voya-data-grid");
    root.set_attribute("data-voya-island", "data-grid")?;
    root.set_inner_html(
        r#"
        <div class="voya-grid-toolbar">
          <input aria-label="Filter rows" data-voya-filter placeholder="Filter rows">
          <button data-voya-sort>Sort score</button>
          <button data-voya-benchmark>Run filter benchmark</button>
          <output data-voya-summary></output>
        </div>
        <div class="voya-grid-viewport" data-voya-viewport>
          <div class="voya-grid-spacer" data-voya-spacer></div>
          <div class="voya-grid-rows" data-voya-rows></div>
        </div>
        "#,
    );
    host.append_child(&root)?;

    let state = Rc::new(RefCell::new(GridState::new(row_count)));
    render(&root, &state.borrow());

    let filter: HtmlInputElement = root
        .query_selector("[data-voya-filter]")?
        .ok_or_else(|| JsValue::from_str("Voya grid filter is missing"))?
        .dyn_into()?;
    let input_root = root.clone();
    let input_state = state.clone();
    let input_handler = Closure::new(move |event: Event| {
        let Some(input) = event
            .target()
            .and_then(|target| target.dyn_into::<HtmlInputElement>().ok())
        else {
            return;
        };
        let mut state = input_state.borrow_mut();
        state.query = input.value();
        state.refresh();
        render(&input_root, &state);
    });
    filter.add_event_listener_with_callback("input", input_handler.as_ref().unchecked_ref())?;

    let sort: HtmlElement = root
        .query_selector("[data-voya-sort]")?
        .ok_or_else(|| JsValue::from_str("Voya grid sort button is missing"))?
        .dyn_into()?;
    let sort_root = root.clone();
    let sort_state = state.clone();
    let sort_handler = Closure::new(move |_event: Event| {
        let mut state = sort_state.borrow_mut();
        state.descending = !state.descending;
        state.refresh();
        render(&sort_root, &state);
    });
    sort.add_event_listener_with_callback("click", sort_handler.as_ref().unchecked_ref())?;

    let benchmark: HtmlElement = root
        .query_selector("[data-voya-benchmark]")?
        .ok_or_else(|| JsValue::from_str("Voya grid benchmark button is missing"))?
        .dyn_into()?;
    let benchmark_root = root.clone();
    let benchmark_state = state.clone();
    let benchmark_handler = Closure::new(move |_event: Event| {
        let mut samples = Vec::with_capacity(BENCHMARK_ROUNDS);
        for _ in 0..BENCHMARK_ROUNDS {
            let started = js_sys::Date::now();
            let mut state = benchmark_state.borrow_mut();
            for query in BENCHMARK_QUERIES {
                state.query = query.to_owned();
                state.refresh();
            }
            samples.push(js_sys::Date::now() - started);
        }
        samples.sort_by(|left, right| left.total_cmp(right));
        let mut state = benchmark_state.borrow_mut();
        state.benchmark = Some((
            samples[BENCHMARK_ROUNDS / 2],
            samples[BENCHMARK_ROUNDS * 95 / 100],
        ));
        render(&benchmark_root, &state);
    });
    benchmark
        .add_event_listener_with_callback("click", benchmark_handler.as_ref().unchecked_ref())?;

    let viewport: HtmlElement = root
        .query_selector("[data-voya-viewport]")?
        .ok_or_else(|| JsValue::from_str("Voya grid viewport is missing"))?
        .dyn_into()?;
    let scroll_root = root.clone();
    let scroll_state = state.clone();
    let scroll_handler = Closure::new(move |event: Event| {
        let Some(viewport) = event
            .target()
            .and_then(|target| target.dyn_into::<HtmlElement>().ok())
        else {
            return;
        };
        let mut state = scroll_state.borrow_mut();
        state.start = (viewport.scroll_top() / ROW_HEIGHT).max(0) as usize;
        render(&scroll_root, &state);
    });
    viewport.add_event_listener_with_callback("scroll", scroll_handler.as_ref().unchecked_ref())?;

    Ok(DataGridHandle {
        root,
        state,
        _handlers: vec![
            input_handler,
            sort_handler,
            benchmark_handler,
            scroll_handler,
        ],
    })
}

fn render(root: &Element, state: &GridState) {
    let total = state.visible.len();
    let start = state.start.min(total.saturating_sub(1));
    let end = (start + WINDOW_SIZE).min(total);
    let rows = state.visible[start..end]
        .iter()
        .map(|id| {
            let row = &state.rows[*id];
            let selected = (state.selected == Some(row.id))
                .then_some(" data-selected")
                .unwrap_or("");
            format!(
                "<div class=\"voya-grid-row\"{selected}><span>{}</span><span>{}</span></div>",
                row.name, row.score
            )
        })
        .collect::<String>();

    if let Ok(Some(summary)) = root.query_selector("[data-voya-summary]") {
        let text = match state.benchmark {
            Some((median, p95)) => format!(
                "{total} matching | 20 filter/sort ops x{BENCHMARK_ROUNDS}: median {median:.1} ms, p95 {p95:.1} ms"
            ),
            None => format!("{total} matching rows"),
        };
        summary.set_text_content(Some(&text));
    }
    if let Ok(Some(spacer)) = root.query_selector("[data-voya-spacer]") {
        let _ = spacer.set_attribute("style", &format!("height: {}px", total as i32 * ROW_HEIGHT));
    }
    if let Ok(Some(container)) = root.query_selector("[data-voya-rows]") {
        let _ = container.set_attribute(
            "style",
            &format!("transform: translateY({}px)", start as i32 * ROW_HEIGHT),
        );
        container.set_inner_html(&rows);
    }
}
