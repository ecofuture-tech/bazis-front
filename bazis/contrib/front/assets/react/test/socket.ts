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

// A fake WebSocket of the page: records the sockets created, the messages sent and the close,
// and receives what a test sends as the server of bazis-ws.

export class FakeSocket {
  static readonly sockets: FakeSocket[] = [];
  readonly sent: unknown[] = [];
  closed: number | null = null;
  onopen: ((event: Event) => void) | null = null;
  onmessage: ((event: MessageEvent) => void) | null = null;
  onclose: ((event: CloseEvent) => void) | null = null;
  onerror: ((event: Event) => void) | null = null;

  constructor(readonly url: string) {
    FakeSocket.sockets.push(this);
  }

  /** The socket created last. */
  static last(): FakeSocket {
    const socket = FakeSocket.sockets.at(-1);
    if (socket === undefined) throw new Error('No socket was created.');
    return socket;
  }

  send(data: string): void {
    this.sent.push(JSON.parse(data));
  }

  close(code?: number): void {
    this.closed = code ?? 1005;
  }

  /** The server accepts the connection. */
  open(): void {
    this.onopen?.(new Event('open'));
  }

  /** A message of the server. */
  receive(message: unknown): void {
    this.onmessage?.(new MessageEvent('message', { data: JSON.stringify(message) }));
  }

  /** A message published to a channel of the session: the server sends its text. */
  publish(published: unknown): void {
    this.receive({ type: 'data', data: typeof published === 'string' ? published : JSON.stringify(published) });
  }

  /** The connection is lost. */
  drop(code = 1011): void {
    this.onclose?.(new CloseEvent('close', { code }));
  }
}
