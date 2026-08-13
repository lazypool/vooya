use wasm_bindgen::{JsCast, JsValue, closure::Closure};
use web_sys::{Document, Element, Event, EventTarget};

/// Cleanup callbacks owned by one generated component mount attempt.
///
/// Generated bindings run this scope if `mount` returns an error and disarm it
/// once the component handle has been stored. Component authors may register
/// cleanup for resources which are not otherwise owned by their `Component`.
#[derive(Clone, Default)]
pub struct MountCleanup {
    callbacks: std::rc::Rc<std::cell::RefCell<Vec<Box<dyn FnOnce()>>>>,
}

impl MountCleanup {
    pub fn defer(&self, callback: impl FnOnce() + 'static) {
        self.callbacks.borrow_mut().push(Box::new(callback));
    }

    pub fn run(&self) {
        let callbacks = std::mem::take(&mut *self.callbacks.borrow_mut());
        for callback in callbacks.into_iter().rev() {
            callback();
        }
    }

    pub fn disarm(&self) {
        self.callbacks.borrow_mut().clear();
    }
}

/// Creates and owns DOM nodes below a framework-provided component host.
pub struct View {
    document: Document,
}

impl View {
    pub fn from_host(host: &Element) -> Result<Self, JsValue> {
        let document = host
            .owner_document()
            .ok_or_else(|| JsValue::from_str("Vooya mount host has no document"))?;
        Ok(Self { document })
    }

    pub fn element(&self, tag: &str) -> Result<ViewElement, JsValue> {
        self.document.create_element(tag).map(ViewElement::new)
    }
}

/// A small, cloneable handle to an element owned by a Vooya component.
#[derive(Clone)]
pub struct ViewElement {
    element: Element,
}

impl ViewElement {
    fn new(element: Element) -> Self {
        Self { element }
    }

    pub fn class(self, class_name: &str) -> Self {
        self.element.set_class_name(class_name);
        self
    }

    pub fn attribute(self, name: &str, value: &str) -> Result<Self, JsValue> {
        self.element.set_attribute(name, value)?;
        Ok(self)
    }

    pub fn text(self, value: &str) -> Self {
        self.element.set_text_content(Some(value));
        self
    }

    pub fn set_text(&self, value: &str) {
        self.element.set_text_content(Some(value));
    }

    pub fn as_element(&self) -> &Element {
        &self.element
    }

    pub fn append(&self, child: &ViewElement) -> Result<(), JsValue> {
        self.element.append_child(&child.element).map(|_| ())
    }

    pub fn mount(&self, host: &Element) -> Result<(), JsValue> {
        host.append_child(&self.element).map(|_| ())
    }

    pub fn on(
        &self,
        event_name: &str,
        handler: impl FnMut(Event) + 'static,
    ) -> Result<EventListener, JsValue> {
        let target: EventTarget = self.element.clone().unchecked_into();
        let callback = Closure::new(handler);
        target.add_event_listener_with_callback(event_name, callback.as_ref().unchecked_ref())?;
        Ok(EventListener {
            target,
            event_name: event_name.to_owned(),
            callback,
        })
    }

    pub fn remove(&self) {
        self.element.remove();
    }
}

/// Keeps a browser event callback alive and unregisters it when dropped.
pub struct EventListener {
    target: EventTarget,
    event_name: String,
    callback: Closure<dyn FnMut(Event)>,
}

impl Drop for EventListener {
    fn drop(&mut self) {
        let _ = self.target.remove_event_listener_with_callback(
            &self.event_name,
            self.callback.as_ref().unchecked_ref(),
        );
    }
}

#[cfg(test)]
mod tests {
    use std::{cell::RefCell, rc::Rc};

    use super::MountCleanup;

    #[test]
    fn mount_cleanup_runs_deferred_callbacks_once_in_reverse_order() {
        let cleanup = MountCleanup::default();
        let calls = Rc::new(RefCell::new(Vec::new()));
        for value in [1, 2] {
            let calls = calls.clone();
            cleanup.defer(move || calls.borrow_mut().push(value));
        }
        cleanup.run();
        cleanup.run();
        assert_eq!(*calls.borrow(), vec![2, 1]);
    }
}
