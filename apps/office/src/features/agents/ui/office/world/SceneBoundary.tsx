"use client";

import { Component, type ReactNode } from "react";

interface SceneBoundaryProps {
  children: ReactNode;
  /** Called once when the scene throws, e.g. after a lost WebGL context; the caller switches to 2D. */
  onError: (error: Error) => void;
}

/** Keeps a failing 3D scene from taking the whole page down. */
export class SceneBoundary extends Component<SceneBoundaryProps, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: Error) {
    this.props.onError(error);
  }

  render() {
    return this.state.failed ? null : this.props.children;
  }
}
