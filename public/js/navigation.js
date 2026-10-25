export const navigation = [
  {section:'Campus',items:[
    {id:'dashboard',label:'Dashboard',icon:'dashboard',roles:['admin','warden','student','security','maintenance','laundry']},
    {id:'students',label:'Students',icon:'students',roles:['admin','warden']},
    {id:'hostels',label:'Hostel Blocks',icon:'building',roles:['admin','warden','security']},
    {id:'rooms',label:'Rooms & Beds',icon:'rooms',roles:['admin','warden','student','maintenance']},
    {id:'allocations',label:'Room Allocation',icon:'allocation',roles:['admin','warden']},
    {id:'wardens',label:'Wardens',icon:'warden',roles:['admin']},
    {id:'staff',label:'Hostel Staff',icon:'staff',roles:['admin','warden']},
  ]},
  {section:'Daily operations',items:[
    {id:'attendance',label:'Attendance',icon:'attendance',roles:['admin','warden']},
    {id:'gate',label:'Gate Entry / Exit',icon:'gate',roles:['admin','warden','security','student']},
    {id:'leaves',label:'Leave Management',icon:'leave',roles:['admin','warden','student','security']},
    {id:'maintenance',label:'Maintenance',icon:'maintenance',roles:['admin','warden','student','maintenance']},
    {id:'complaints',label:'Complaints',icon:'complaints',roles:['admin','warden','student']},
    {id:'laundry',label:'Laundry',icon:'laundry',roles:['admin','warden','student','laundry']},
    {id:'cleaning',label:'Room Cleaning',icon:'clean',roles:['admin','warden','student','maintenance']},
    {id:'inspections',label:'Room Inspections',icon:'clipboard',roles:['admin','warden']},
    {id:'feedback',label:'Student Feedback',icon:'feedback',roles:['admin','warden','student']},
  ]},
  {section:'Campus life & safety',items:[
    {id:'notifications',label:'Notifications',icon:'bell',roles:['admin','warden','student','security','maintenance','laundry']},
    {id:'safety',label:'Safety & Emergency',icon:'safety',roles:['admin','warden','student','security']},
    {id:'iot',label:'IoT Monitoring',icon:'iot',roles:['admin','warden','student','maintenance']},
    {id:'reports',label:'Reports',icon:'chart',roles:['admin','warden']},
    {id:'settings',label:'Settings',icon:'settings',roles:['admin','warden']},
  ]},
];

export const routeTitles=Object.fromEntries(navigation.flatMap(section=>section.items.map(item=>[item.id,item.label])));
export function pagesFor(role){return navigation.flatMap(section=>section.items).filter(item=>item.roles.includes(role)).map(item=>item.id);}
