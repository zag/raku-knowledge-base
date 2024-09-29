import {
  composePlugins,
  isExistsDocBlocks,
  PluginConfig,
  PodliteWebPlugin,
  PodliteWebPluginContext,
  processFile,
  publishRecord,
} from "@podlite/publisher";
import * as CRC32 from "crc-32";
import React from "react";
import * as fs from "fs";
import {
  getFromTree,
  getTextContentFromNode,
  makeAttrs,
  makeInterator,
  mkRootBlock,
  PodNode,
} from "@podlite/schema";
import { url } from "inspector";

export const modPlugin = ({ rootdir }): PodliteWebPlugin => {
  const mods_state = require("../built/mods-tree.json"); //.splice(0, 10)
  const all_mods = require("../built/ecosystem.json");
  const zef_mods = require("../built/mods.json");

  const outCtx: PodliteWebPluginContext = {};
  const onExit = (ctx) => ({ ...ctx, ...outCtx });
  const processNode = (node: PodNode, file: string) => {
    function isRemoteUrl(url: string): boolean {
      try {
        const parsedUrl = new URL(url);
        return ["http:", "https:"].includes(parsedUrl.protocol);
      } catch (error) {
        // If URL parsing fails, assume it's a local path
        return false;
      }
    }

    const rules = {
      // we need add prefic to all /doc/ links
      "L<>": (node) => {
        const { meta, content } = node;
        const link = meta ? meta : getTextContentFromNode(content);
        return { ...node, meta: isRemoteUrl(link) ? meta : `/doc${link}` };
      },
    };
    return makeInterator(rules)(node, {});
  };
  const onProcess = (recs: publishRecord[]) => {
    // filter out files without docuemntation
    const filesWithDocs = mods_state.filter((item) =>
      isExistsDocBlocks(item.node),
    );
    //   convert all doc: links to file:: links
    const addedUrls = filesWithDocs.map((item) => {
      const publishUrl = item.file.replace(/^work_mods/g, "/mods");
      //   .replace(/^.*?(?=\/mods)/g, '')
      //   .replace(/\.\S+$/, '')
      // const node = processNode(item.node, item.file)
      return { ...item, publishUrl, node: item.node };
    });

    // const addedUrls = mods_state
    console.log(`modPlugin is running: ${rootdir}`);

    //  group mods by type and add meta info
    const mods_info = addedUrls.reduce((acc, item) => {
      // console.log(item.file)
      const [_, namespace, name] = item.file.split("/");
      acc[namespace] = acc[namespace] || {};
      acc[namespace][name] = acc[namespace][name] || {};
      let meta;
      // get metat info
      if (namespace === "zef") {
        meta = zef_mods.find((i) => i.name === name);
      } else {
        meta = all_mods.find((i) => i.name === name);
      }
      if (!meta) {
        throw new Error(`meta not found for ${name}`);
      }
      const moduleInfo = {
        ...acc[namespace][name],
        meta,
        files: [
          ...(acc[namespace][name]["files"] || []),
          { file: item.file, publishUrl: item.publishUrl },
        ],
        src: namespace,
        url: "/mods/" + namespace + "/" + name,
      };

      acc[namespace][name] = moduleInfo;
      return acc;
    }, {});
    if (rootdir) {
      fs.writeFileSync(
        `${rootdir}/built/mods-info.json`,
        JSON.stringify({ mods_info }, null, 2),
      );
    }

    // generate pages for each module
    const all_mods_pages = Object.values({
      ...(mods_info.all || {}),
      ...(mods_info.zef || {}),
    });

    const mapFileNameToModuleInfo: any = all_mods_pages.reduce(
      (acc: any, item) => {
        const { files } = item as any;
        if (files.length === 0) return acc;
        files.forEach((file) => {
          acc[file.file] = item;
        });
        return acc;
      },
      {},
    );

    // fill module info for each doc
    // add moduleInfo to each mods document

    addedUrls.forEach((item) => {
      if (mapFileNameToModuleInfo[item.file]) {
        item.pluginsData = item.pluginsData || {};
        item.pluginsData.moduleInfo = mapFileNameToModuleInfo[item.file];
      }
    });

    const makePage = (item, index_item) => {
      return `
    =begin pod :puburl<${item.url}>
    =TITLE ${item.meta.name}
    =SUBTITLE ${item.meta.description}
    =useReact {RenderItem} from 'raku-knowledge/components'
    =begin React :component<RenderItem>
    =begin data
    ${JSON.stringify(index_item)}
    =end data
    =end React
 
    
    =end pod
    `;
    };
    interface FileInfo {
      file: string;
      publishUrl: string;
    }

    const chooseRootFile = (files: FileInfo[]): string | null => {
      if (files.length === 0) return null;

      return files.sort((a, b) => {
        const pathA = a.file.split("/");
        const pathB = b.file.split("/");

        // First, compare path lengths
        if (pathA.length !== pathB.length) {
          return pathA.length - pathB.length;
        }

        // If path lengths are equal, check for README.md
        const isReadmeA = a.file.toLowerCase().endsWith("readme.md");
        const isReadmeB = b.file.toLowerCase().endsWith("readme.md");

        if (isReadmeA && !isReadmeB) return -1;
        if (!isReadmeA && isReadmeB) return 1;

        // If both or neither are README.md, compare alphabetically
        return a.file.localeCompare(b.file);
      })[0].file;
    };
    const modulePages = all_mods_pages.map((item: any) => {
      // get root document for first module page
      const { files } = item as any;
      const root_file = chooseRootFile(files);
      const index_item = root_file
        ? (addedUrls as publishRecord[]).find((i) => i.file === root_file)
        : null;
      const mod_item = processFile(
        "src/module-template.podlite",
        makePage(item, index_item),
        "text/podlite",
      );
      // add module info to
      mod_item.pluginsData = mod_item.pluginsData || {};
      mod_item.pluginsData.moduleInfo = item;
      return mod_item;
    });
    console.log("[modPlugin] collect all doc records");
    // collect all doc records
    const controlJson = addedUrls.reduce((acc, item) => {
      acc[item.publishUrl] = item;
      return acc;
    }, {});
    if (rootdir) {
      fs.writeFileSync(
        `${rootdir}/built/mods-control.json`,
        JSON.stringify({ urls: controlJson }, null, 2),
      );
    }
    console.log("[modPlugin] collect all doc records - ok");
    // get template
    const [template] = [...recs, ...addedUrls, ...modulePages].filter((i) =>
      i.file.match(/src.template.podlite$/),
    );
    if (!template) throw new Error("template : src/template.podlite not found");
    const all = [...recs, ...addedUrls, ...modulePages].filter(
      (i) => !i.file.match(/src.template.podlite$/),
    );
    // add template to each doc
    all.forEach((i) => (i.template_file = template.file));
    console.log("[modPlugin] fix title");
    // fix title
    all.forEach(
      (i) =>
        (i.title =
          i.title ||
          i.file
            .split("/")
            .pop()
            .replace(/\.\S+$/, "")),
    );
    console.log("finishg modPlugin");
    return [...recs, ...addedUrls, ...modulePages].filter((i) => i.publishUrl); //.filter(i => !i.file.match(/src.template.podlite$/))
  };

  return [onProcess, onExit];
};

export const docPlugin = ({ rootdir }): PodliteWebPlugin => {
  const docs_state = require("../built/docs-tree.json")//.splice(0, 100);

  const outCtx: PodliteWebPluginContext = {};
  const onExit = (ctx) => ({ ...ctx, ...outCtx });
  const processNode = (node: PodNode, file: string) => {
    function isRemoteUrl(url: string): boolean {
      try {
        const parsedUrl = new URL(url);
        return ["http:", "https:"].includes(parsedUrl.protocol);
      } catch (error) {
        // If URL parsing fails, assume it's a local path
        return false;
      }
    }

    const rules = {
      // we need add prefic to all /doc/ links
      "L<>": (node) => {
        const { meta, content } = node;
        const link = meta ? meta : getTextContentFromNode(content);
        return { ...node, meta: isRemoteUrl(link) ? meta : `/doc${link}` };
      },
    };
    return makeInterator(rules)(node, {});
  };
  const onProcess = (recs: publishRecord[]) => {
    // convert all doc: links to file:: links
    const addedUrls = docs_state
      .map((item) => {
        const publishUrl = item.file
          .toLowerCase()
          .replace(/^.*?(?=\/doc)/g, "")
          .replace(/\.\S+$/, "");
        const node = processNode(item.node, item.file);
        return { ...item, publishUrl, node };
      })
      .filter(
        (i) =>
          ![
            //list of files to exclude
            "/doc/announcements",
          ].includes(i.publishUrl),
      );

    console.log(`docPlugin is running: ${rootdir}`);
    // get template
    const [template] = [...recs, ...addedUrls].filter((i) =>
      i.file.match(/src.template.podlite$/),
    );
    if (!template) throw new Error("template : src/template.podlite not found");
    const all = [...recs, ...addedUrls].filter(
      (i) => !i.file.match(/src.template.podlite$/),
    );
    // add template to each doc
    all.forEach((i) => (i.template_file = template.file));

    // collect all doc records
    const controlJson = addedUrls.reduce((acc, item) => {
      acc[item.publishUrl] = item;
      return acc;
    }, {});
    if (rootdir) {
      fs.writeFileSync(
        `${rootdir}/built/control.json`,
        JSON.stringify({ urls: controlJson }, null, 2),
      );
    }

    // index all docs with kind, subkind, category

    const categoryIndex = addedUrls.reduce((acc, item) => {
      const { node, template, ...attrs } = item;
      // get pod node
      const [podnode] = getFromTree(node, "pod");
      if (podnode) {
        const conf = makeAttrs(podnode, {});
        const kind = conf.getFirstValue("kind");
        const subkind = conf.getFirstValue("subkind");
        const category = conf.getFirstValue("category");
        acc.push({ ...attrs, kind, subkind, category });
      }
      return acc;
    }, []);
    if (rootdir) {
      fs.writeFileSync(
        `${rootdir}/built/index-category.json`,
        JSON.stringify({ categoryIndex }, null, 2),
      );
    }

    // fills addonsData.seealso depends on kind, subkind, category
    addedUrls.forEach((item) => {
      const categoryRec = categoryIndex.find(
        (i) => i.publishUrl === item.publishUrl,
      );
      if (categoryRec) {
        const { kind, subkind, category } = categoryRec;
        const seeAlso = categoryIndex
          .filter(
            (i) =>
              i.publishUrl !== item.publishUrl &&
              i.kind === kind &&
              i.subkind === subkind &&
              i.category === category,
          )
          .map((i) => {
            return {
              publishUrl: i.publishUrl,
              title: i.title,
              subtitle: i.subtitle,
            };
          });
        if (seeAlso.length > 0) {
          item.pluginsData = item.pluginsData || {};
          item.pluginsData.seeAlso = seeAlso;
        }
      }
    });

    return [...recs, ...addedUrls].filter((i) => i.publishUrl);
  };

  return [onProcess, onExit];
};

export const splitDocAndCode = (doc: publishRecord) => {
    const blocks:PodNode[] = []
    const code:PodNode[] = []
    const processNode = (node: PodNode, srcfile: string) => {
        const rules = {
        ':ambient' : (node) => {
            const {text, location, type} = node
            code.push(text)
        },
         ':block': (node, ctx, interator) => {
            if ( node.name === 'root') {
                if (node.content) {
                  return interator(node.content, ctx)
                }
                return
              }
            blocks.push(node)
          },
        }
        return makeInterator(rules)(node, {})
      }
    processNode(doc.node, doc.file)
    const getCodePod = (text)=>{
return `=begin code :lang<raku>
${text}
=end code
`        
    }
    const { node } = processFile('src/file2', getCodePod(code.join('\n')), 'text/podlite')
    const root  = mkRootBlock({},[...blocks, node])
    return { ...doc, node: root}
}

export const examplesPlugin = ({ rootdir }): PodliteWebPlugin => {
    const examples_state = require("../built/examples-tree.json")
  
    const outCtx: PodliteWebPluginContext = {};
    const onExit = (ctx) => ({ ...ctx, ...outCtx });
    const processNode = (node: PodNode, file: string) => {
      function isRemoteUrl(url: string): boolean {
        try {
          const parsedUrl = new URL(url);
          return ["http:", "https:"].includes(parsedUrl.protocol);
        } catch (error) {
          // If URL parsing fails, assume it's a local path
          return false;
        }
      }
  
      const rules = {
        // we need add prefic to all /doc/ links
        "L<>": (node) => {
          const { meta, content } = node;
          const link = meta ? meta : getTextContentFromNode(content);
          return { ...node, meta: isRemoteUrl(link) ? meta : `/doc${link}` };
        },
      };
      return makeInterator(rules)(node, {});
    };
    const onProcess = (recs: publishRecord[]) => {
      // convert all doc: links to file:: links
      console.log(`examplesPlugin is running: ${rootdir}`);
      const addedUrls = examples_state
        .map((item) => {
            const publishUrl = item.file.replace(/^work_examples\/categories/g, "/examples");
            return { ...item, publishUrl, node: item.node };
        })
     // process body
      const bodyProcessed = addedUrls.map((item) => {
            return splitDocAndCode(item)
      })
      // get template
      const [template] = [...recs, ...bodyProcessed].filter((i) =>
        i.file.match(/src.template.podlite$/),
      );
      if (!template) throw new Error("template : src/template.podlite not found");
      const all = [...recs, ...bodyProcessed].filter(
        (i) => !i.file.match(/src.template.podlite$/),
      );
      // add template to each doc
      all.forEach((i) => (i.template_file = template.file));
  
      // index all docs with kind, subkind, category
  
      const categoryIndex = bodyProcessed.reduce((acc, item) => {
        const { file, node, template, publishUrl, subtitle, title, ...attrs } = item;
        // get pod node
        const category = publishUrl.split(/\//).splice(2,1).shift();
        const filename = publishUrl.split(/\//).splice(3).shift();
        acc[category] =  acc[category] || []
        acc[category].push({ file, publishUrl, title, category, filename, subtitle });
        return acc;
      }, {});
      
      if (rootdir) {
        fs.writeFileSync(
          `${rootdir}/built/examples-index-category.json`,
          JSON.stringify({ categoryIndex }, null, 2),
        );
      }
  
      // fills addonsData.seealso depends on kind, subkind, category
      bodyProcessed.forEach((item) => {
        const categoryRec:any[]= Object.values(categoryIndex).find(
          (i) => (i as any[]).map(t=>t.file).includes(item.file),
        ) as any[];
        if (categoryRec) {
          const seeAlso = categoryRec
            .filter(
              (i) =>
                i.publishUrl !== item.publishUrl
            )
            .map((i) => {
              return {
                publishUrl: i.publishUrl,
                title: i.filename,
                subtitle: i.title,
              };
            });
          if (seeAlso.length > 0) {
            item.pluginsData = item.pluginsData || {};
            item.pluginsData.seeAlso = seeAlso;
          }
        }
      });
      // fix title
      bodyProcessed.forEach(
        (i) =>
          (i.title =
            i.title ||
            i.file
              .split("/")
              .pop()
              .replace(/\.\S+$/, "")),
      );
      return [...recs, ...bodyProcessed].filter((i) => i.publishUrl);
    };
  
    return [onProcess, onExit];
  };

export const plugin = (): PodliteWebPlugin => {
  const outCtx: PodliteWebPluginContext = {};
  const onExit = (ctx) => ({ ...ctx, ...outCtx });
  const onProcess = (recs: publishRecord[]) => {
    console.log("plugin running1" + CRC32.str("sdsd"));
    return recs;
  };

  return [onProcess, onExit];
};

const makePlugins = ({ rootdir }) => {
  const makeDocPlugin: PluginConfig = {
    plugin: docPlugin({ rootdir }),
    includePatterns: ".*",
  };
  const makeModsPlugin: PluginConfig = {
    plugin: modPlugin({ rootdir }),
    includePatterns: ".*",
  };
    const makeExamplesPlugin: PluginConfig = {
        plugin: examplesPlugin({ rootdir }),
        includePatterns: ".*",
    };

  return composePlugins([makeDocPlugin, makeModsPlugin, makeExamplesPlugin], {});
//   return composePlugins([makeDocPlugin, makeExamplesPlugin], {})
};

export default makePlugins;
