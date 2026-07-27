use std::{cell::RefCell, rc::Rc};

pub type Effect = Rc<dyn Fn()>;

/// Single-threaded reactive state for browser components.
#[derive(Clone)]
pub struct Signal<T> {
    value: Rc<RefCell<T>>,
    effects: Rc<RefCell<Vec<Effect>>>,
}

pub fn signal<T>(value: T) -> Signal<T> {
    Signal {
        value: Rc::new(RefCell::new(value)),
        effects: Rc::new(RefCell::new(Vec::new())),
    }
}

pub fn effect(callback: impl Fn() + 'static) -> Effect {
    Rc::new(callback)
}

impl<T: Clone> Signal<T> {
    pub fn get(&self) -> T {
        self.value.borrow().clone()
    }
}

impl<T> Signal<T> {
    pub fn set(&self, value: T) {
        *self.value.borrow_mut() = value;
        self.notify();
    }

    pub fn update(&self, update: impl FnOnce(&mut T)) {
        update(&mut self.value.borrow_mut());
        self.notify();
    }

    pub fn subscribe(&self, callback: Effect) {
        self.effects.borrow_mut().push(callback);
    }

    fn notify(&self) {
        let callbacks = self.effects.borrow().clone();
        for callback in callbacks {
            callback();
        }
    }
}

#[cfg(test)]
mod tests {
    use std::{cell::Cell, rc::Rc};

    use super::{effect, signal};

    #[test]
    fn signals_run_subscribed_effects_after_updates() {
        let count = signal(1);
        let seen = Rc::new(Cell::new(0));
        let seen_in_effect = seen.clone();
        let count_in_effect = count.clone();
        count.subscribe(effect(move || seen_in_effect.set(count_in_effect.get())));

        count.update(|value| *value += 2);

        assert_eq!(count.get(), 3);
        assert_eq!(seen.get(), 3);
    }
}
