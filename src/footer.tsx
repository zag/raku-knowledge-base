import { publishRecord } from "@podlite/publisher";
import React from "react";
import styles from "./footer.module.css";
export const Footer = ({ id, children, item, renderNode }) => {
  var style = { "--count-columns ": children.length };
  const { title, footer } = item as publishRecord;
  return (
    <>
      <div className={styles.footer}>
        <p>This is a footr for {item.title}</p>
        {children}
      </div>
    </>
  );
};
