import React, { ReactNode } from "react";
import styles from "./Breadcrumb.module.css";
import Link from "next/link";
interface BreadcrumbItem {
  title: string;
  publishUrl: string;
  component: ReactNode;
}

interface BreadcrumbProps {
  items: BreadcrumbItem[];
}

const Breadcrumb: React.FC<BreadcrumbProps> = ({ items }) => {
  return (
    <nav className={styles.breadcrumb}>
      <ol className={styles.list}>
        {items.map((item, index) => (
          <li key={index} className={styles.item}>
            {index > 0 && <span className={styles.separator}>/</span>}
            {item.component ? (
              item.component
            ) : (
              <Link href={item.publishUrl}>{item.title}</Link>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
};

export default Breadcrumb;
