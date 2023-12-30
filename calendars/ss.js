const num = [2, 4, 6, 8];
const newNum = num.flatMap((v) => [v*v, v*v*v, v+1]);
console.log(JSON.stringify(newNum));

const ss= num.map((v)=>{
   if (v*v<10) return v*v;
   return [v*(v+1),v*(v+2)]; 
});

const rs= ss.flatMap((v)=>v);
console.log(rs);
console.log(ss);
