"use client";

import { Component, type ReactNode } from "react";

interface Props {
  fallback: ReactNode;
  children: ReactNode;
}

/* Any WebGL failure (no context, shader or GPGPU init error, lost context)
   degrades to the static fallback instead of a blank hero. */
export class CanvasGuard extends Component<Props, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: unknown) {
    console.error("WebGL scene failed", error);
  }

  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}
