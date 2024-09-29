// SearchComponent.tsx
import React, { useState, useEffect, useCallback, useRef } from "react";
import styles from "./SearchComponent.module.css";
//@ts-expect-error
import { PagefindUI } from "@pagefind/default-ui";

const SearchComponent: React.FC = ({ isHidden }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    if ((event.metaKey || event.ctrlKey) && event.key === "k") {
      event.preventDefault();
      setIsOpen(true);
    } else if (event.key === "Escape") {
      setIsOpen(false);
    }
  }, []);
  React.useEffect(() => {
    console.log("useEffect");
    async function loadPagefind() {
      if (typeof window.pagefind === "undefined") {
        try {
          //   window.pagefind = await import(
          // See the `pagefind:local` npm script to "hack" the pagefind content for local dev.
          //   process.env.NODE_ENV !== 'development'
          //     ? '/pagefind/pagefind.js'
          //     :
          //       /* webpackIgnore: true */ '/_next/static/chunks/pagefind/pagefind.js'

          window.pagefind = await import(
            // @ts-expect-error pagefind.js generated after build
            /* webpackIgnore: true */ "/pagefind/pagefind-ui.js"
          );
        } catch (e) {
          window.pagefind = { search: () => ({ results: [] }) };
        }
      }
    }
    loadPagefind();
  }, []);
  useEffect(() => {
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [handleKeyDown]);

  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  useEffect(() => {
    if (isOpen && inputRef.current) {
      if (typeof window !== "undefined" && window.PagefindUI) {
        const pageFind = new window.PagefindUI({
          element: "#search",
          // debounceTimeoutMs: 0,
          showSubResults: true,
          autofocus: true,
        });
        return () => {
          pageFind.destroy();
        };
      }
    }
  }, [isOpen]);
  const handleSearch = (event: React.FormEvent) => {
    event.preventDefault();
    // Implement your search logic here
    console.log("Searching for:", searchTerm);
  };
  const SearchButton = () => (
    <nav className={styles.nav}>
      <button
        onClick={() => setIsOpen(true)}
        data-variant="large"
        type="button"
      >
        Search documentation...<kbd>⌘K</kbd>
      </button>
    </nav>
  );
  //   if (!isOpen) return null;
  const Dialog = () => (
    <div className={styles.overlay}>
      <div className={styles.modal}>
        <div ref={inputRef} id="search" />
      </div>
    </div>
  );
  return (
    <>
      {!isHidden && SearchButton()}
      {isOpen && Dialog()}
    </>
  );
};

export default SearchComponent;
