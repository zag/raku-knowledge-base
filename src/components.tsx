import { publishRecord } from "@podlite/publisher";
import React from "react";
import styles from "./footer.module.css";
import listfilesstyles from "./listfiles.module.css";
import listModsStyles from "./listmods.module.css";
import Switcher from "./Switcher";
import Breadcrumb from "./Breadcrumb";
import { getTextContentFromNode } from "@podlite/schema";
import Link from "next/link";
export * from "./footer";
import SearchComponentIn from "./SearchComponent";

interface TwoColumnLayoutProps {
  LeftContent: React.ComponentType;
  RightContent: React.ComponentType;
}

export const TwoColumnLayout: React.FC<TwoColumnLayoutProps> = ({
  LeftContent,
  RightContent,
}) => {
  return (
    <div style={styles.container}>
      <div style={styles.leftColumn}>
        <LeftContent />
      </div>
      <div style={styles.rightColumn}>
        <RightContent />
      </div>
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: "flex",
    minHeight: "100vh",
  },
  leftColumn: {
    flexGrow: 1,
    padding: "0 24px",
    overflowY: "auto",
  },
  rightColumn: {
    width: "375px",
    // padding: "24px",
    // backgroundColor: "#f3f4f6",
    position: "sticky",
    top: 0,
    // height: "100vh",
    // overflowY: "auto",
  },
};

export const ShowExamplesCategory = ({ id: er, children, item, renderNode, category }) => {
    const d: any = require("../built/examples-index-category.json");
    const categorySelected =  d.categoryIndex[category]
    if (!categorySelected) { return <><h1>Category {category} not found</h1>
    <pre><code>${JSON.stringify(Object.keys(d.categoryIndex), null,2)}</code></pre>
    </> }
    
    return (
        <>
          <ul>
            {categorySelected.map(({publishUrl,title,filename}, index) => (
              <li key={index}>
                <span className={listfilesstyles.subtitle}>
                  <a href={publishUrl}>{title}</a>{" "}
                </span>
                <span className={listfilesstyles.title}>
                  <a href={publishUrl}>
                    {filename.trim()}{" "}
                  </a>
                </span>

              </li>
            ))}
          </ul>
        </>
      );
}

export const Test = ({ id: er, children, item, renderNode }) => {
  const { id, title, subtitle, footer, template, header } = item;
  const Article: React.FC = () => (
    <article key={id}>
      <header>
        {item.publishUrl !== "/" && <h1>{title}</h1>}
        {subtitle && <div className="abstract">{subtitle}</div>}
      </header>
      {item && renderNode(item.node)}
    </article>
  );
  if (item?.pluginsData?.moduleInfo) {
    return (
      <TwoColumnLayout
        LeftContent={Article}
        RightContent={() => (
          <>
            <RakuModuleInfo data={item?.pluginsData?.moduleInfo} />
          </>
        )}
      />
    );
  }
  return <Article />;
};

export const ShowBreadcrumb = ({
  id,
  children,
  item,
  renderNode,
  isShowRoot,
}) => {
  // no breadcrumb for root
  if (item.publishUrl === "/") return null;
  const breadcrumb = (item as publishRecord)?.pluginsData?.breadcrumb || {};
  return (
    <>
      {" "}
      <Breadcrumb
        items={[
          ...(isShowRoot
            ? [{ publishUrl: "/", component: <Link href="/">🦋</Link> }]
            : []),
          ...breadcrumb,
        ]}
      />{" "}
    </>
  );
};

export const SeeAlso = ({ id, children, item, renderNode, getThisNode }) => {
  const seeAlso = (item as publishRecord)?.pluginsData?.seeAlso || {};
  if (seeAlso && seeAlso.length > 0) {
    return (
      <>
        <h2>See Also</h2>
        {seeAlso.map((item) => (
          <div key={item.publishUrl}>
            <p>
              <a href={item.publishUrl}>{item.title}</a>
              <div>{item.subtitle}</div>
            </p>
          </div>
        ))}
      </>
    );
  }
  return <></>;
};
export const RenderItem = ({ id, children, item, renderNode, getThisNode }) => {
  const item_to_render = JSON.parse(getTextContentFromNode(getThisNode()));
  // console.log(JSON.stringify(item_to_render))
  if (!item_to_render) return;
  //   const {title, subtitle, footer} = item
  return <>{renderNode(item_to_render.node)}</>;
  // return <>{renderNode(item_to_render.node)}</>;
};
const shortenFileName = (fileName: string, maxLength: number = 30): string => {
  if (fileName.length <= maxLength) return fileName;
  const parts = fileName.split("/");
  const lastPart = parts.pop() || "";
  let shortened = lastPart;
  for (let i = parts.length - 1; i >= 0; i--) {
    const newShortened = `.../${parts[i]}/${shortened}`;
    if (newShortened.length > maxLength) break;
    shortened = newShortened;
  }
  return shortened;
};

interface ModuleInfo {
  meta: {
    name: string;
    version: string;
    description: string;
    authors: string[];
    license: string;
    depends: string[];
    "test-depends": string[];
    provides: {
      [key: string]: string;
    };
  };
}
const parseAuthor = (authorString: string): Author => {
  const match = authorString.match(/^(.+?)\s*(?:<(.+)>)?$/);
  return {
    name: match ? match[1] : authorString,
  };
};
interface Author {
  name: string;
}

const RakuModuleInfo: React.FC<{ data: ModuleInfo }> = ({ data }) => {
  const { meta, src, files } = data;
  if (src !== "zef") return <></>;
  const documentationFiles = files.filter(
    (file) =>
      file.file.toLowerCase().includes("doc") ||
      file.file.toLowerCase().includes("readme"),
  );
  const getModuleLink = (dependency: string): string => {
    // This is a placeholder function. You should replace this with the actual logic
    // to generate the correct link for each dependency.
    const baseName = dependency.split(/\b:(?!:)/)[0];
    return `/mods/${data.src}/${baseName}`;
  };

  return (
    <>
      <style>
        {`
            .card {
              width: 100%;
              max-width: 48rem;
            //   border: 1px solid #e2e8f0;
            //   border-radius: 0.5rem;
            //   box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06);
            //   background-color: #ffffff;
            }
            .card-header {
              padding: 0.5rem;
              border-bottom: 1px solid #e2e8f0;
            }
            .card-title {
              font-size: 1.5rem;
              font-weight: bold;
              margin-bottom: 0.5rem;
            }
            .card-title  {
            margin-top: 0;}
            .card-description {
              font-size: 0.875rem;
              color: #718096;
            }
            .card-content {
              padding: 0.5rem;
            }
            .section {
              margin-bottom: 0.5rem;
            }
            .section-title {
              font-size: 1.125rem;
              font-weight: 600;
              margin-bottom: 0.5rem;
            }
            .list {
              list-style-type: none;
              padding-left: 1.5rem;
            }
            .badge {
              display: inline-block;
              padding: 0.25rem 0.5rem;
              border-radius: 0.25rem;
              font-size: 0.75rem;
              font-weight: 500;
              margin-right: 0.5rem;
              margin-bottom: 0.5rem;
            }
            .dependency-badge {
              background-color: #e2e8f0;
              color: #4a5568;
            }
                        .dependency-badge:hover {
            background-color: #cbd5e0;
          }
            .test-dependency-badge {
              background-color: #fff;
              border: 1px solid #cbd5e0;
              color: #4a5568;
            }
            .doc-link {
              color: #4299e1;
              text-decoration: none;
            }
            .doc-link:hover {
              text-decoration: underline;
            }
          `}
      </style>
      <div className="card">
        <div className="card-header">
          <h2 className="card-title">
            {meta.name} v{meta.version}
          </h2>
          <p className="card-description">{meta.description}</p>
        </div>
        <div className="card-content">
          <div className="section">
            <h3 className="section-title">Authors</h3>
            <ul className="list">
              {Array.isArray(meta["authors"]) &&
                meta.authors.map((author, index) => (
                  <li key={index}>{parseAuthor(author).name}</li>
                ))}
            </ul>
          </div>

          <div className="section">
            <h3 className="section-title">License</h3>
            <p>{meta.license}</p>
          </div>

          <div className="section">
            <h3 className="section-title">Dependencies</h3>
            <div>
              {Array.isArray(meta["depends"]) &&
                meta.depends.map((dep, index) => (
                  <span key={index} className="badge dependency-badge">
                    {dep}
                  </span>
                ))}
            </div>
          </div>

          <div className="section">
            <h3 className="section-title">Test Dependencies</h3>
            <div>
              {Array.isArray(meta["test-depends"]) &&
                meta["test-depends"].map((dep, index) => (
                  <a
                    key={index}
                    href={getModuleLink(dep)}
                    className="badge test-dependency-badge"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {dep}
                  </a>
                ))}
            </div>
          </div>

          <div className="section">
            <h3 className="section-title">Provides</h3>
            <ul className="list">
              {Object.entries(meta.provides)?.map(([key, value], index) => (
                <li key={index}>
                  <strong>{key}</strong>
                </li>
              ))}
            </ul>
          </div>

          {documentationFiles.length > 0 && (
            <div className="section">
              <h3 className="section-title">Documentation</h3>
              <ul className="list">
                {documentationFiles.map((file, index) => (
                  <li key={index}>
                    <a
                      href={file.publishUrl}
                      className="doc-link"
                      rel="noopener noreferrer"
                    >
                      {shortenFileName(file.file)}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    </>
  );
};
export const ModulePage = ({ id, children, item, renderNode, getThisNode }) => {
  const info = JSON.parse(getTextContentFromNode(getThisNode()));
  //   console.log(info);

  return (
    <>
      <h1>Module page</h1>
      <RakuModuleInfo data={info} />
      {children}
    </>
  );
};

export const IndexAllDocs = ({ id, children, item, renderNode }) => {
  const d: any = require("../built/control.json");
  var style = { "--count-columns ": children.length };
  //   const {title, footer} = item as publishRecord
  return (
    <>
      <div className={styles.footer}>
        <h2>Index all docs</h2>
        <ul>
          {Object.entries(d.urls).map(([key, value]) => (
            <li key={key}>
              <a href={(value as any).publishUrl}>{(value as any).title} </a>
            </li>
          ))}
        </ul>
      </div>
    </>
  );
};

export const SearchComponent = ({
  id,
  children,
  item,
  renderNode,
  isHidden,
}) => {
  return (
    <>
      <SearchComponentIn isHidden={isHidden} />
    </>
  );
};
export const ListMods = ({ id, children, item, renderNode }) => {
  const d: any = require("../built/mods-info.json");
  // const [ecosystem, setEcosystem] = ['zef', ()=>{}];//React.useState('zef');
  const [ecosystem, setEcosystem] = React.useState("zef");
  const groupAndSortProperties = (obj) => {
    const sorted = Object.keys(obj).sort();
    const grouped = sorted.reduce((acc, key) => {
      const firstLetter = key[0].toUpperCase();
      if (!acc[firstLetter]) {
        acc[firstLetter] = [];
      }
      acc[firstLetter].push(key);
      return acc;
    }, {});
    return grouped;
  };

  const { all, zef } = d.mods_info;
  const activelist = ecosystem === "p6c" ? all : zef;
  const groupedProperties = groupAndSortProperties(activelist);
  return (
    <div>
      <h2>Sorted and Grouped Modules ({Object.keys(activelist).length})</h2>
      <p className={listModsStyles.choose}>
        <div>Choose ecosystem:</div>
        <div>
          <Switcher
            leftLabel="p6c"
            rightLabel="zef"
            onChange={(isRight) => setEcosystem(isRight ? "zef" : "p6c")}
          />
        </div>
      </p>
      <>
        {Object.entries(groupedProperties).map(([letter, properties]) => (
          <div key={letter}>
            <h3>{letter}</h3>
            <ul className={listModsStyles.group}>
              {(properties as string[])
                .sort(function (a, b) {
                  return a.toLowerCase().localeCompare(b.toLowerCase());
                })
                .map((prop) => (
                  <li key={prop}>
                    <span className={listModsStyles.title}>
                      <a href={activelist[prop]?.url}>{prop} </a>
                    </span>
                    <span className={listModsStyles.subtitle}>
                      <a href={"/mods/" + prop}>
                        {activelist[prop]?.meta?.description}
                      </a>{" "}
                    </span>
                  </li>
                ))}
            </ul>
          </div>
        ))}
      </>
    </div>
  );
};

export const ListFiles = ({ id, children, item, renderNode, select }) => {
  const d: any = require("../built/index-category.json");
  const filterByField = (field, value, item) => {
    return item[field] === value;
  };
  const filtered = d.categoryIndex.filter((item) => {
    if (select.kind) {
      if (!filterByField("kind", select.kind, item)) return false;
    }
    if (select.subkind) {
      if (!filterByField("subkind", select.subkind, item)) return false;
    }
    if (select.category) {
      if (!filterByField("category", select.category, item)) return false;
    }
    return true;
  });
  const { title, footer, file } = item as publishRecord;
  // console.log(filtered)
  return (
    <>
      <ul>
        {Object.entries(filtered).map(([key, value]) => (
          <li key={key}>
            <span className={listfilesstyles.title}>
              <a href={(value as any).publishUrl}>
                {(value as any).title.trim()}.{" "}
              </a>
            </span>
            <span className={listfilesstyles.subtitle}>
              <a href={(value as any).publishUrl}>{(value as any).subtitle}</a>{" "}
            </span>
          </li>
        ))}
      </ul>
    </>
  );
};
