const GH='https://api.github.com';
const owner=()=>process.env.GITHUB_OWNER||'lovepreetsinghlove201-eng';
const repo=()=>process.env.GITHUB_REPO||'Onlytiler-13-website';

function auth(req){
  return req.headers['x-admin-password'] &&
    process.env.ADMIN_PASSWORD &&
    req.headers['x-admin-password']===process.env.ADMIN_PASSWORD;
}

async function gh(path,opts={}){
  const r=await fetch(GH+path,{
    ...opts,
    headers:{
      Authorization:`Bearer ${process.env.GITHUB_TOKEN}`,
      Accept:'application/vnd.github+json',
      'X-GitHub-Api-Version':'2022-11-28',
      'Content-Type':'application/json',
      ...(opts.headers||{})
    }
  });
  const text=await r.text();
  let data;
  try{data=JSON.parse(text)}catch{data={message:text}}
  if(!r.ok)throw new Error(data.message||`GitHub error ${r.status}`);
  return data;
}

const b64=s=>Buffer.from(s).toString('base64');

module.exports=async(req,res)=>{
  try{
    if(req.method==='GET'){
      if(!auth(req))return res.status(401).json({error:'Unauthorized'});
      const f=await gh(`/repos/${owner()}/${repo()}/contents/projects.json`);
      return res.status(200).json(
        JSON.parse(Buffer.from(f.content,'base64').toString('utf8'))
      );
    }

    if(req.method!=='POST')
      return res.status(405).json({error:'Method not allowed'});

    if(!auth(req))
      return res.status(401).json({error:'Unauthorized'});

    const {title,description,category,photos}=req.body||{};

    if(!title||!Array.isArray(photos)||!photos.length)
      return res.status(400).json({error:'Title and photos are required'});

    const stamp=Date.now();
    const uploaded=[];

    for(let n=0;n<photos.length;n++){
      const p=photos[n];
      const ext=(p.name||'jpg').split('.').pop()
        .toLowerCase().replace(/[^a-z0-9]/g,'')||'jpg';

      const path=`uploads/${stamp}-${n+1}.${ext}`;

      await gh(`/repos/${owner()}/${repo()}/contents/${path}`,{
        method:'PUT',
        body:JSON.stringify({
          message:`Add project photo: ${title}`,
          content:p.data.replace(/^data:[^;]+;base64,/,'')
        })
      });

      uploaded.push(path);
    }

    let projects=[];

    const f=await gh(
      `/repos/${owner()}/${repo()}/contents/projects.json`
    );

    projects=JSON.parse(
      Buffer.from(f.content,'base64').toString('utf8')
    );

    const item={
      id:`project-${stamp}`,
      title,
      description:description||'',
      category:category||'Other',
      image:uploaded[0],
      images:uploaded
    };

    projects.unshift(item);

    await gh(
      `/repos/${owner()}/${repo()}/contents/projects.json`,
      {
        method:'PUT',
        body:JSON.stringify({
          message:`Add project: ${title}`,
          content:b64(JSON.stringify(projects,null,2)+'\n'),
          sha:f.sha
        })
      }
    );

    return res.status(200).json({
      ok:true,
      project:projects[0]
    });

  }catch(e){
    return res.status(500).json({error:e.message});
  }
};
