import { heightAt, project, type Surface, type TerrainLink } from './elevation';
export function connectorPlacement(link: TerrainLink, map: Surface) {
  const legacy = link.id === undefined && link.kind === undefined && link.asset === undefined;
  const kind = legacy ? 'stairs' : link.kind;
  const asset = legacy ? 'stone-stairs' : link.asset;
  if ((!legacy && !link.id) || !kind || asset !== ({stairs:'stone-stairs',ladder:'timber-ladder'} as const)[kind])
    throw new Error('높이 연결 지형의 종류 또는 에셋이 올바르지 않습니다.');
  const [low, high] = heightAt(link.start,map) < heightAt(link.end,map) ? [link.start,link.end] : [link.end,link.start];
  const dc=high.column-low.column,dr=high.row-low.row;
  if (Math.abs(dc)+Math.abs(dr)!==1 || heightAt(high,map)-heightAt(low,map)!==1)
    throw new Error('높이 연결 지형은 한 단계 높이의 인접 타일이어야 합니다.');
  const direction = dc===1?'east':dc===-1?'west':dr===1?'south':'north';
  const a=project(low,map),b=project(high,map);
  return { key:`${asset}-${direction}`,x:(a.x+b.x)/2,y:(a.y+b.y)/2 };
}
