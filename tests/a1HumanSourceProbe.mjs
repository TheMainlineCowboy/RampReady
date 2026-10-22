// CC0 MakeHuman figures, source-authorized by Innerscene 3D Parts Library.
// Do not commit static binary until user reviews actual geometry and animations.
const SOURCES = [
  ["sam-animated", "https://www.innerscene.com/api/library/locomotion-collection-sam-3d-person-animated-dc23800f/download"],
  ["drew-hi-vis", "https://www.innerscene.com/api/library/drew-3d-person-construction-worker-with-hard-hat-and-hi-vis-a4aa98af/download"],
];
for (const [name,url] of SOURCES) {
  const r=await fetch(url,{headers:{accept:"application/octet-stream"}});
  console.log(name, "status", r.status, "content-type", r.headers.get("content-type"), "CORS", r.headers.get("access-control-allow-origin"));
  if(!r.ok) throw new Error(name+" source not accessible: HTTP "+r.status);
  const bytes=new Uint8Array(await r.arrayBuffer());
  const magic=String.fromCharCode(...bytes.slice(0,4));
  console.log(name,"size",bytes.length,"magic",magic);
  if(magic!=="glTF" || bytes.length < 1_000_000) throw new Error("Invalid GLB: "+name);
}
