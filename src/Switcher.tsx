// Switcher.tsx
import React, { useState } from "react";
import styles from "./Switcher.module.css";

interface SwitcherProps {
  leftLabel: string;
  rightLabel: string;
  onChange?: (isRight: boolean) => void;
}

const Switcher: React.FC<SwitcherProps> = ({
  leftLabel,
  rightLabel,
  onChange,
}) => {
  const [isRight, setIsRight] = useState(true);

  const handleToggle = () => {
    const newState = !isRight;
    setIsRight(newState);
    if (onChange) {
      onChange(newState);
    }
  };

  return (
    <div className={styles.switcher}>
      <span className={`${styles.label} ${!isRight ? styles.active : ""}`}>
        {leftLabel}
      </span>
      <button
        className={`${styles.toggle} ${isRight ? styles.right : ""}`}
        onClick={handleToggle}
        aria-checked={isRight}
        role="switch"
      >
        <span className={styles.slider} />
      </button>
      <span className={`${styles.label} ${isRight ? styles.active : ""}`}>
        {rightLabel}
      </span>
    </div>
  );
};

export default Switcher;
