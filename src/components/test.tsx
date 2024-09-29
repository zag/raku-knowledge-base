export {};
// export const Search = ()=>{
//     const [query, setQuery] = useState("")
//     const content = contentData().map((item)=>{
//         getFromTree(item.node, "para")
//     })
//     return (
//         <p>
//         <input placeholder="Enter Post Title" onChange={event => setQuery(event.target.value)} />
//         <b>{query}</b>
//         {
//          content.map((item, index) => {
//         return <div key={index}>
//           <p>{ getTextContentFromNode(item.node)}</p>
//           <p>{item.type}</p>
//         </div>
//         })
//     }
//         </p>
// )}
