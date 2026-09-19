import * as React from 'preact';
import { render } from 'preact';
import { useState } from 'preact/hooks';
import { BattleReport } from './src/ui/BattleReport';
import './src/styles.css';
function Preview() {
 const [open,setOpen]=useState(false);
 const [done,setDone]=useState(false);
 return <><button onClick={()=>{setOpen(true);setDone(false)}}>리포트 열기</button>{done && <p>스폰서 광고 로딩 단계</p>}{open && <BattleReport result={{battleId:'preview',result:'WIN',coins:10,xp:0}} onReturn={()=>{setOpen(false);setDone(true)}} />}</>;
}
render(<Preview/>,document.getElementById('app')!);
