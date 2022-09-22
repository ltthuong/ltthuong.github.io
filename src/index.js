import React from "react";
import App from "./App";
import { BrowserRouter as Router } from "react-router-dom";
import "./styles/stylesheet.scss";
import { createRoot } from "react-dom/client";
import "./index.css";

const container = document.getElementById("root");
const root = createRoot(container);

root.render(
  <Router basename={process.env.PUBLIC_URL}>
    <App />
  </Router>
);
