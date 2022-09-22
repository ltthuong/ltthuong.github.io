import React from "react";
import AnimatedCursor from "./layouts/AnimatedCursor";
import Container from "./layouts/Container";

function App() {
  React.useEffect(() => {
    document.documentElement.style.cursor = "none";
    return () => {
      document.documentElement.style.cursor = "auto";
    };
  }, []);

  return (
    <>
      <AnimatedCursor />
      <main>
        <Container />
      </main>
    </>
  );
}

export default App;
