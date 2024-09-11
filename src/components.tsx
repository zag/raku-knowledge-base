import { publishRecord } from '@podlite/publisher'
import React from 'react'
import styles from './footer.module.css'
export * from './footer'

export const Test = ({ id, children, item, renderNode }) => {
  var style = { '--count-columns ': children.length }
  if (!item) return
  //   const {title, subtitle, footer} = item
  return <>{renderNode(item.node)}</>
}

export const IndexAllDocs = ({ id, children, item, renderNode }) => {
  const d: any = require('../built/control.json')
  var style = { '--count-columns ': children.length }
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
  )
}
