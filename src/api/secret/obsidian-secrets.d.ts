import type { App, BaseComponent } from "obsidian";

// Provides type definitions for Obsidian's SecretStorage API 
// This module extends the existing Obsidian types to include the SecretStorage interface and related components
declare module "obsidian" {
  interface SecretStorage {
    get(key: string): string | null | Promise<string | null>;
    set(key: string, value: string | null): void;
    delete?(key: string): void;
  }

  interface App {
    secretStorage?: SecretStorage;
  }

  class SecretComponent extends BaseComponent {
    constructor(app: App, containerEl: HTMLElement);
    setValue(value: string): this;
    onChange(callback: (value: string | null) => void): this;
  }

  interface Setting {
    addComponent(cb: (el: HTMLElement) => BaseComponent): this;
  }
}