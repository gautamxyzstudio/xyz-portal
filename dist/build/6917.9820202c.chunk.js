"use strict";(self.webpackChunkxyz_hrportal=self.webpackChunkxyz_hrportal||[]).push([[6917],{66917:(S,f,s)=>{s.r(f),s.d(f,{default:()=>V});var e=s(92132),g=s(21272),c=s(42455),D=s(4198),h=s(94061),v=s(38413),l=s(55356),T=s(35513),A=s(26127),m=s(90361),E=s(33363),d=s(30893),p=s(25641),u=s(83997),M=s(88353),j=s(25815),r=s(55506),P=s(83925),O=s(70603),L=s(50612),B=s(14718),y=s(54894),a=s(63891),_=s(41945),i=s(95062),q=s(74930);const V=()=>{(0,r.L4)();const{formatMessage:n}=(0,y.A)(),{data:o,isLoading:U,isError:F,remove:G,regenerate:N}=(0,i.u)(),[x,R]=(0,g.useState)(!1),[X,W]=(0,g.useState)(!1),[H,Q]=(0,g.useState)(),{allowedActions:C}=(0,r.ec)(_.P),Z=4,J=(o?.docVersions?.length||0)+1,Y=t=>{N.mutate({version:t,prefix:o?.prefix})},w=()=>{R(!x)},b=async()=>{W(!0),await G.mutateAsync({prefix:o?.prefix,version:H}),R(!x),W(!1)},k=t=>{Q(t),R(!x)},$=n({id:(0,i.g)("plugin.name"),defaultMessage:"Documentation"});return F?(0,e.jsx)(c.P,{children:(0,e.jsx)(D.s,{children:(0,e.jsx)(h.a,{paddingTop:8,children:(0,e.jsx)(r.hH,{})})})}):(0,e.jsxs)(c.P,{children:[(0,e.jsx)(B.m,{title:$}),(0,e.jsxs)(v.g,{"aria-busy":U,children:[(0,e.jsx)(l.Q,{title:$,subtitle:n({id:(0,i.g)("pages.PluginPage.header.description"),defaultMessage:"Configure the documentation plugin"}),primaryAction:(0,e.jsx)(z,{disabled:!C.canOpen||!o?.currentVersion||!o?.prefix,href:K(`${o?.prefix}/v${o?.currentVersion}`),startIcon:(0,e.jsx)(P.A,{}),children:n({id:(0,i.g)("pages.PluginPage.Button.open"),defaultMessage:"Open Documentation"})})}),(0,e.jsxs)(D.s,{children:[U&&(0,e.jsx)(r.Bl,{children:"Plugin is loading"}),o?.docVersions.length?(0,e.jsxs)(T.X,{colCount:Z,rowCount:J,children:[(0,e.jsx)(A.d,{children:(0,e.jsxs)(m.Tr,{children:[(0,e.jsx)(E.Th,{children:(0,e.jsx)(d.o,{variant:"sigma",textColor:"neutral600",children:n({id:(0,i.g)("pages.PluginPage.table.version"),defaultMessage:"Version"})})}),(0,e.jsx)(E.Th,{children:(0,e.jsx)(d.o,{variant:"sigma",textColor:"neutral600",children:n({id:(0,i.g)("pages.PluginPage.table.generated"),defaultMessage:"Last Generated"})})})]})}),(0,e.jsx)(p.N,{children:o.docVersions.sort((t,I)=>t.generatedDate<I.generatedDate?1:-1).map(t=>(0,e.jsxs)(m.Tr,{children:[(0,e.jsx)(E.Td,{width:"50%",children:(0,e.jsx)(d.o,{children:t.version})}),(0,e.jsx)(E.Td,{width:"50%",children:(0,e.jsx)(d.o,{children:t.generatedDate})}),(0,e.jsx)(E.Td,{children:(0,e.jsxs)(u.s,{justifyContent:"end",onClick:I=>I.stopPropagation(),children:[(0,e.jsx)(M.K,{forwardedAs:"a",disabled:!C.canOpen,href:K(`${o.prefix}/v${t.version}`),noBorder:!0,icon:(0,e.jsx)(P.A,{}),target:"_blank",rel:"noopener noreferrer",label:n({id:(0,i.g)("pages.PluginPage.table.icon.show"),defaultMessage:"Open {target}"},{target:`${t.version}`})}),C.canRegenerate?(0,e.jsx)(M.K,{onClick:()=>Y(t.version),noBorder:!0,icon:(0,e.jsx)(O.A,{}),label:n({id:(0,i.g)("pages.PluginPage.table.icon.regenerate"),defaultMessage:"Regenerate {target}"},{target:`${t.version}`})}):null,C.canUpdate&&t.version!==o.currentVersion?(0,e.jsx)(M.K,{onClick:()=>k(t.version),noBorder:!0,icon:(0,e.jsx)(L.A,{}),label:n({id:"global.delete-target",defaultMessage:"Delete {target}"},{target:`${t.version}`})}):null]})})]},t.version))})]}):(0,e.jsx)(r.pA,{})]}),(0,e.jsx)(r.TM,{isConfirmButtonLoading:X,onConfirm:b,onToggleDialog:w,isOpen:x})]})]})},z=(0,a.Ay)(j.z)`
  text-decoration: none;
`,K=n=>n.startsWith("http")?n:n.startsWith("/")?`${window.strapi.backendURL}${n}`:`${window.strapi.backendURL}/${n}`},95062:(S,f,s)=>{s.d(f,{g:()=>h,u:()=>v});var e=s(21272),g=s(55506),c=s(74930),D=s(41945);const h=l=>`${D.p}.${l}`,v=()=>{const l=(0,g.hN)(),{del:T,post:A,put:m,get:E}=(0,g.ry)(),{formatAPIError:d}=(0,g.wq)(),{isLoading:p,isError:u,data:M,refetch:j,error:r}=(0,c.useQuery)(["get-documentation",D.p],async()=>{const{data:a}=await E(`/${D.p}/getInfos`);return a});(0,e.useEffect)(()=>{u&&r&&l({type:"warning",message:r?d(r):{id:"notification.error"}})},[u,r,l,d]);const P=a=>{l({type:"warning",message:d(a)})},O=(a,_,i)=>{j(),l({type:a,message:{id:h(_),defaultMessage:i}})},L=(0,c.useMutation)(({prefix:a,version:_})=>T(`${a}/deleteDoc/${_}`),{onSuccess:()=>O("info","notification.delete.success","Successfully deleted documentation"),onError:P}),B=(0,c.useMutation)(({prefix:a,body:_})=>m(`${a}/updateSettings`,_),{onSuccess:()=>O("success","notification.update.success","Successfully updated settings"),onError:P}),y=(0,c.useMutation)(({prefix:a,version:_})=>A(`${a}/regenerateDoc`,{version:_}),{onSuccess:()=>O("info","notification.generate.success","Successfully generated documentation"),onError:P});return{data:M,isLoading:p,isError:u,remove:L,submit:B,regenerate:y}}}}]);