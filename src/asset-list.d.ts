declare module "*.asset-list.yaml" {
 const registeredAssetPaths: Record<string,string>;
 export default registeredAssetPaths;
}

declare module "*field-material-frames.yaml" {
 const currentMaterialFrames: Record<string,string>;
 export default currentMaterialFrames;
}

declare module "*world-map/thumbnails.yaml" { const registeredThumbnailUrls: Record<string,string>; export default registeredThumbnailUrls; }
