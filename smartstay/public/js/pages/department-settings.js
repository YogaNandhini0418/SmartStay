import {api,esc,button,panel,table,badge,field,formModal,toast} from '../components.js';
export async function departmentSettings(ctx){
  const rows=await api('departments');
  function edit(row={}){return formModal(row.id?'Configure department':'Add engineering department',[field('name','Department name'),...(row.id?[field('active','Registration availability','select',[{value:1,label:'Available for registration'},{value:0,label:'Hidden from new registrations'}])]:[])],row,async d=>{await api(row.id?`departments/${row.id}`:'departments',row.id?'PATCH':'POST',d);toast('Department configuration saved.');await ctx.refresh();},{submit:'Save department',subtitle:'Existing student records remain unchanged when a department is disabled.'});}
  ctx.on('department-add',()=>edit());ctx.on('department-edit',id=>edit(rows.find(r=>r.id===Number(id))));
  return {html:panel('Engineering departments','Shared by student registration and student management.','<div id="department-table"></div>',button('Add department','department-add','plus','outline')),mount(){table(document.querySelector('#department-table'),rows,[{key:'name',label:'Department'},{key:'active',label:'Registration',render:r=>badge(r.active?'Available':'Inactive',r.active?'green':'neutral')},{key:'actions',label:'Action',render:r=>button('Configure','department-edit','edit','outline',`data-id="${r.id}"`)}],{pageSize:5});}};
}
