/** 렌더링 조정값의 단일 원본. 게임·검수 배포본은 이 모듈에서만 값을 가져온다. */
export const GAME_INTERNAL_RESOLUTION_SCALE = 2;
export const CHARACTER_OUTLINE_BASE_WIDTH = 1;
export const CHARACTER_OUTLINE_BASE_COLOR = 0x655d54;
export const CHARACTER_SEPARATOR_BASE_WIDTH = 1;
export const CHARACTER_SEPARATOR_BASE_COLOR = 0xfff2cc;
export const CHARACTER_CONTACT_SHADOW_COLOR = 0x242424;
export const CHARACTER_CONTACT_SHADOW_ALPHA_SCALE = 1.2;
export const MAP_DEFAULT_ZOOM = 2;
export const MAP_TILE_WIDTH = 80;
export const MAP_TILE_HEIGHT = 40;
export const GAME_TILE_SOURCE_SIZES = Object.freeze([64, 128, 256, 512]);
export const CHARACTER_BODY_HEIGHT = 80;
export const MAP_ELEVATION_HEIGHT = 32;
export const MAP_BASE_THICKNESS = 16;
export const WORLD_UNIT_MIGRATION = 1.3;
export const TOWN_TILE_WIDTH = 160;
export const TOWN_TILE_HEIGHT = 80;
export const FIELD_ELEVATION_EDGE_STYLE = Object.freeze({color:0x303030,width:4,alpha:0.85});
export const FIELD_MESH_BOUNDARY_STYLE = Object.freeze({color:0xdce5ef,width:1,alpha:0.9});
export const FIELD_ACTOR_CONTACT_SHADOW_PROFILES = Object.freeze({
 baseline:Object.freeze({width:0.4,height:0.32,alpha:0.3,coreAlpha:0.24,coreScale:0.65,scale:1.3,opacityScale:1.5}),
 contrast:Object.freeze({width:0.4,height:0.32,alpha:0.36,coreAlpha:0.3,coreScale:0.65,scale:1.3,opacityScale:1.5}),
 broad:Object.freeze({width:0.44,height:0.34,alpha:0.32,coreAlpha:0.26,coreScale:0.65,scale:1.3,opacityScale:1.5}),
});
export const FIELD_ACTOR_CONTACT_SHADOW_COLOR = 0x18392e;
export const FIELD_SAFE_TOWER_PROFILE = Object.freeze({anchorX:627,anchorY:1095,bodyTop:82,displayHeight:112});
export const FIELD_SAFE_AURA_PROFILE = Object.freeze({columns:4,rows:2,frames:8,height:15,alpha:0.7,frameDuration:120,horizontalCrop:0.02,topCrop:0.25,bottomCrop:0.1});
export const FIELD_CONNECTION_SHAPE = Object.freeze({inset:.08,radius:.2,half:.5});
export const TERRAIN_STAIR_COUNT = 3;
export const CHARACTER_OUTLINE_STYLE = Object.freeze({color:0xfff3c4,cssColor:'#fff3c4',width:5,outerStrength:4,quality:0.1});
export const MAP_ORIGIN = { x: 1040, y: 80 };
export const TERRAIN_DEPTH = { stride: 100, base: 100, surface: 1, overlay: 10, actor: 20, annotation: 10000 };
export const BUILDING_RENDER_BLOCK_HEIGHT = 80;
export const CITY_BUILDING_STYLE = {
  wallLight:0xc8b68d, wallDark:0x8f8067,
  outlineColor:0x453d35, outlineWidth:2, selectedColor:0xffdd78, selectedWidth:4,
  roofAlpha:0.9, labelFont:'17px', labelOffset:12, entranceRadius:7,
  roofColors:{guild:0x467c75,bookshop:0x755c84,inn:0xa56f54,workshop:0x626f7a,market:0xd4ad63},
};
export const HUMAN_REST_HEIGHT_RATIO = 1;
export const SLIME_RATIO = 0.5;
export const MAX_MONSTER_RATIO = 2;
export const ACTOR_CONTACT_SHADOW_CONTRACT = Object.freeze({profile:'contrast'});
export const SPRITE_DEPTH_OFFSET = 0.01;
export const CHARACTER_OUTLINE_DEPTH_STEP = 0.0001;
export const FIELD_RENDER_METRICS = Object.freeze({tileWidth:MAP_TILE_WIDTH,tileHeight:MAP_TILE_HEIGHT,elevationHeight:MAP_ELEVATION_HEIGHT,baseThickness:MAP_BASE_THICKNESS});

/** 바닥 재질 영역 경계는 게임·검수에서 기본 표시한다. */
export const TERRAIN_MATERIAL_BOUNDARY_ENABLED = true;

export const BUILDING_BOUNDARY_ENABLED = true;

// 지붕 무늬는 면의 UV 좌표에서 반시계 방향으로 회전한다.
export const BUILDING_ROOF_TEXTURE_ROTATION_RADIANS = -Math.PI / 2;
