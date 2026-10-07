// Copyright 2026 EcoFuture Technology Services LLC and contributors
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

import { Component, type ReactNode } from 'react';

import { errorState, StatePanel } from '@/bazis/ui/state-panel';

interface Props {
  children: ReactNode;
  /**
   * A value whose change clears the error, such as the path of the screen: the screens under
   * the boundary are not mounted again when it changes (a list keeps its filters next to its
   * card).
   */
  resetKey?: unknown;
}

interface State {
  failed: boolean;
  error: unknown;
}

/**
 * Shows the error of a screen instead of a blank page, with a retry: its state and its
 * message as every component shows them (`StatePanel`, `state:<state>`).
 */
export class ErrorBoundary extends Component<Props, State> {
  override state: State = { failed: false, error: undefined };

  static getDerivedStateFromError(error: unknown): State {
    return { failed: true, error };
  }

  override componentDidUpdate(previous: Props) {
    if (this.state.failed && previous.resetKey !== this.props.resetKey) {
      this.setState({ failed: false, error: undefined });
    }
  }

  override render() {
    if (!this.state.failed) return this.props.children;
    return (
      <StatePanel
        state={errorState(this.state.error)}
        error={this.state.error}
        className="mx-auto max-w-xl"
        onRetry={() => {
          this.setState({ failed: false, error: undefined });
        }}
      />
    );
  }
}
