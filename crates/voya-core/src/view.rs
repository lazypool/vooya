use wasm_bindgen::{JsCast, JsValue, closure::Closure};
use web_sys::{Document, Element, Event, EventTarget};

/// Creates and owns DOM nodes below a framework-provided component host.
pub struct View {
    document: Document,
}

impl View {
    pub fn from_host(host: &Element) -> Result<Self, JsValue> {
        let document = host
            .owner_document()
            .ok_or_else(|| JsValue::from_str("Voya mount host has no document"))?;
        Ok(Self { document })
    }

    pub fn element(&self, tag: &str) -> Result<ViewElement, JsValue> {
        self.document.create_element(tag).map(ViewElement::new)
    }
}

/// A small, cloneable handle to an element owned by a Voya component.
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
