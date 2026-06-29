import { Asset, AssetListLoader } from 'playcanvas';

export async function loadAssets(app, assetDefinitions) {
  const assets = assetDefinitions.map((definition) => new Asset(
    definition.name,
    definition.type,
    { url: definition.url }
  ));

  const loader = new AssetListLoader(assets, app.assets);
  await new Promise((resolve, reject) => {
    loader.load((err) => {
      if (err) {
        reject(err);
        return;
      }

      resolve();
    });
  });

  return assets;
}
