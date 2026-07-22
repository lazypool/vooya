import { useState } from "react";
import Counter from "./Counter.voya";

export function App() {
  const [initial, setInitial] = useState(1);
  const [lastChange, setLastChange] = useState<number>();

  return (
    <main>
      <h1>Voya inside React</h1>
      <Counter
        initial={initial}
        className="counter-host"
        onChange={(value) => setLastChange(value)}
      />
      <p>React received: {lastChange ?? "no event"}</p>
      <button onClick={() => setInitial(10)}>Set React prop to 10</button>
    </main>
  );
}
