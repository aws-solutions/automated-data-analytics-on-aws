/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { delay } from '$common/utils';
import { userEvent } from '@storybook/testing-library';

interface SqlEditorEventOptions {
  readonly eventDelay: number;
  readonly typeDelay: number;
}

const DEFAULT_EVENT_OPTIONS: SqlEditorEventOptions = {
  eventDelay: 10,
  typeDelay: 10,
};

export class SqlEditorController {
  readonly editor: HTMLDivElement;
  readonly input: HTMLTextAreaElement;
  readonly content: HTMLDivElement;
  readonly gutter: HTMLDivElement;

  readonly options: SqlEditorEventOptions;

  constructor(readonly dom: HTMLDivElement, options?: Partial<SqlEditorEventOptions>) {
    if (dom.className.includes('ace_editor')) {
      this.editor = dom;
    } else {
      this.editor = dom.querySelector('.ace_editor')!;
    }
    this.input = this.editor.querySelector('.ace_text-input')!;
    this.content = this.editor.querySelector('.ace_content')!;
    this.gutter = this.editor.querySelector('.ace_gutter')!;

    this.options = {
      ...DEFAULT_EVENT_OPTIONS,
      ...options,
    };
  }

  get value() {
    return this.content.textContent;
  }

  currentCompletions(): HTMLElement[] {
    const completions = this.content.ownerDocument.querySelector('.ace_autocomplete');
    if (completions == null) return [];
    const highlights = Array.from(completions.querySelectorAll('.ace_completion-highlight'));
    return highlights.map((node) => node.parentElement!);
  }

  async selectCompletion(text: string, _meta?: string) {
    const completions = this.currentCompletions();
    for (const completion of completions) {
      if (completion.textContent?.startsWith(text)) {
        return completion;
      } else {
        await this.type('{arrowdown}');
      }
    }

    return null;
  }

  async clickCompletion(text: string, meta?: string) {
    const completion = await this.selectCompletion(text, meta);
    if (completion == null) {
      throw new Error(`Failed to find completion with "${text}"`);
    }
    console.log('completion:', completion);
    await delay(10);
    completion.click();
  }

  async clickContent() {
    userEvent.click(this.content);
    await delay(this.options.eventDelay);
  }

  async dblClickContent() {
    userEvent.dblClick(this.content);
    await delay(this.options.eventDelay);
  }

  async clickGutter() {
    userEvent.click(this.gutter);
    await delay(this.options.eventDelay);
  }

  async dblClickGutter() {
    userEvent.dblClick(this.gutter);
    await delay(this.options.eventDelay);
  }

  async selectAll() {
    await this.dblClickGutter();
  }

  async end() {
    await this.clickContent();
    await this.type('{end}');
  }

  async clear() {
    await this.selectAll();

    userEvent.keyboard('{Delete}');
    await delay(this.options.eventDelay);
  }

  async type(value: string, typeDelay?: number) {
    await userEvent.keyboard(value, { delay: typeDelay || this.options.typeDelay });
    // delay after keyboard typing is necessary to prevent loss of focus uncommitting input values
    // which leads to truncated final value in editor
    await delay(200);
  }

  async append(value: string) {
    await this.end();
    await this.type(value);
  }

  async setValue(value?: string, typeDelay?: number) {
    await this.clear();
    await this.end();

    if (value) {
      await this.type(value, typeDelay);
    }
  }
}

export async function findSQLEditor(container: HTMLElement): Promise<SqlEditorController> {
  const sqlEditor: HTMLDivElement | null = container.querySelector('#sql-editor');

  if (sqlEditor == null) throw new Error('Failed to find sql editor');

  return new SqlEditorController(sqlEditor);
}
