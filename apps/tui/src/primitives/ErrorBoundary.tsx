import React, { Component, type ErrorInfo, type ReactNode } from "react";
import { Box as InkBox, Text as InkText } from "ink";

interface ErrorBoundaryProps {
  children: ReactNode;
  /** Optional label for the context where the error occurred */
  context?: string;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

/**
 * Global error boundary that catches React rendering errors and displays
 * a styled error box instead of crashing the entire TUI.
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    // Log to stderr so it doesn't pollute the TUI output
    process.stderr.write(
      `[TUI Error] ${error.message}\n${errorInfo.componentStack ?? ""}\n`,
    );
  }

  render(): ReactNode {
    if (this.state.hasError && this.state.error) {
      const { context } = this.props;
      const { error } = this.state;

      return (
        <InkBox flexDirection="column" paddingX={1} paddingY={1}>
          <InkBox
            flexDirection="column"
            borderStyle="round"
            borderColor="red"
            paddingX={2}
            paddingY={1}
          >
            <InkBox gap={1}>
              <InkText color="red" bold>
                x
              </InkText>
              <InkText color="red" bold>
                Something went wrong{context ? ` in ${context}` : ""}
              </InkText>
            </InkBox>
            <InkBox paddingLeft={2} marginTop={1}>
              <InkText color="red">{error.message}</InkText>
            </InkBox>
            <InkBox paddingLeft={2} marginTop={1}>
              <InkText dimColor>
                Press q to go back, or / to open command palette.
              </InkText>
            </InkBox>
          </InkBox>
        </InkBox>
      );
    }

    return this.props.children;
  }
}
