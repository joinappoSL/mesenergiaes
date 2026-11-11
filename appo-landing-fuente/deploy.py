import os, json, hashlib, subprocess, sys
ROOT = "/tmp/claude-0/-home-user-mesenergiaes/df60c1c2-15ee-560c-9d35-37995e47140e/scratchpad/site"
T = "team_BNybjAJkCNZMrBE4VQsQEgUi"
files = []
for d, _, fs in os.walk(ROOT):
    for f in fs:
        p = os.path.join(d, f); rel = os.path.relpath(p, ROOT)
        data = open(p, "rb").read(); sha = hashlib.sha1(data).hexdigest()
        r = subprocess.run(["curl","-sS","-o","/dev/null","-w","%{http_code}","-X","POST","https://api.vercel.com/v2/files?teamId="+T,
            "-H","Content-Type: application/octet-stream","-H","x-vercel-digest: "+sha,"--data-binary","@"+p],capture_output=True,text=True)
        print(rel, r.stdout); files.append({"file": rel, "sha": sha, "size": len(data)})
body = {"name":"v0-appo-landing-page","project":"prj_LBi9je6QLnRczDwzp6K6z91o3VM2","target":"production","files":files,
        "projectSettings":{"framework":None,"buildCommand":None,"installCommand":None,"outputDirectory":"."}}
open("/tmp/claude-0/body2.json","w").write(json.dumps(body))
r = subprocess.run(["curl","-sS","-X","POST","https://api.vercel.com/v13/deployments?teamId="+T+"&skipAutoDetectionConfirmation=1",
    "-H","Content-Type: application/json","--data","@/tmp/claude-0/body2.json"],capture_output=True,text=True)
j = json.loads(r.stdout); print({k:j.get(k) for k in ("id","url","readyState","target","inspectorUrl","error")})
