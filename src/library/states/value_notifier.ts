type Listener<T> = (state: T) => void;

export class ValueNotifier<T> {
  private state: T;
  private listeners: Set<Listener<T>> = new Set();

  constructor(initialState: T) {
    this.state = initialState;
  }

  listen(listener: Listener<T>, initialCall: boolean = false) {
    this.listeners.add(listener);
    if (initialCall) {
      listener(this.state);
    }

    return () => {
      this.listeners.delete(listener);
    };
  }

  get value(): T {
    return this.state;
  }

  set value(newState: T) {
    this.state = newState;
    this.notify();
  }

  notify() {
    this.listeners.forEach((listener) => listener(this.state));
  }
}

export class DerivedValueNotifier<T> extends ValueNotifier<T> {
  private derivedListeners: Set<() => void> = new Set();

  constructor(
    notifiers: ValueNotifier<any>[],
    calc: (notifiers: ValueNotifier<any>[], currentValue: T | undefined) => T,
  ) {
    super(calc(notifiers, undefined));

    for (const notifier of notifiers) {
      let derivedListener = notifier.listen((_) => {
        this.value = calc(notifiers, this.value);
      });
      this.derivedListeners.add(derivedListener);
    }
  }

  dispose() {
    this.derivedListeners.forEach((listener) => listener());
  }
}
