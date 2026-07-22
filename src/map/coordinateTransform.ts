export type CoordinateSystem = 'WGS84' | 'GCJ02' | 'BD09';
export type GeographicCoordinate = [longitude: number, latitude: number];

const a = 6378245;
const ee = 0.00669342162296594323;
const xPi = Math.PI * 3000 / 180;

export function isValidCoordinate([longitude, latitude]: GeographicCoordinate) {
  return Number.isFinite(longitude) && Number.isFinite(latitude) && Math.abs(longitude) <= 180 && Math.abs(latitude) <= 90;
}

export function convertCoordinate(coordinate: GeographicCoordinate, source: CoordinateSystem, target: CoordinateSystem): GeographicCoordinate {
  if (!isValidCoordinate(coordinate)) throw new Error('经度需在 -180 至 180 之间，纬度需在 -90 至 90 之间');
  if (source === target) return [...coordinate];
  const gcj = source === 'WGS84' ? wgs84ToGcj02(coordinate) : source === 'BD09' ? bd09ToGcj02(coordinate) : coordinate;
  if (target === 'GCJ02') return gcj;
  if (target === 'BD09') return gcj02ToBd09(gcj);
  return gcj02ToWgs84(gcj);
}

export function wgs84ToGcj02(coordinate: GeographicCoordinate): GeographicCoordinate {
  const [longitude, latitude] = coordinate;
  if (outOfChina(longitude, latitude)) return [...coordinate];
  const delta = getDelta(longitude, latitude);
  return [longitude + delta[0], latitude + delta[1]];
}

export function gcj02ToWgs84(coordinate: GeographicCoordinate): GeographicCoordinate {
  const [longitude, latitude] = coordinate;
  if (outOfChina(longitude, latitude)) return [...coordinate];
  let guess: GeographicCoordinate = [longitude, latitude];
  for (let index = 0; index < 6; index += 1) {
    const converted = wgs84ToGcj02(guess);
    guess = [guess[0] + longitude - converted[0], guess[1] + latitude - converted[1]];
  }
  return guess;
}

export function gcj02ToBd09([longitude, latitude]: GeographicCoordinate): GeographicCoordinate {
  const distance = Math.sqrt(longitude * longitude + latitude * latitude) + 0.00002 * Math.sin(latitude * xPi);
  const angle = Math.atan2(latitude, longitude) + 0.000003 * Math.cos(longitude * xPi);
  return [distance * Math.cos(angle) + 0.0065, distance * Math.sin(angle) + 0.006];
}

export function bd09ToGcj02([longitude, latitude]: GeographicCoordinate): GeographicCoordinate {
  const x = longitude - 0.0065;
  const y = latitude - 0.006;
  const distance = Math.sqrt(x * x + y * y) - 0.00002 * Math.sin(y * xPi);
  const angle = Math.atan2(y, x) - 0.000003 * Math.cos(x * xPi);
  return [distance * Math.cos(angle), distance * Math.sin(angle)];
}

function outOfChina(longitude: number, latitude: number) {
  return longitude < 72.004 || longitude > 137.8347 || latitude < 0.8293 || latitude > 55.8271;
}

function getDelta(longitude: number, latitude: number): GeographicCoordinate {
  const dLat = transformLat(longitude - 105, latitude - 35);
  const dLon = transformLon(longitude - 105, latitude - 35);
  const radLat = latitude / 180 * Math.PI;
  const magic = 1 - ee * Math.sin(radLat) * Math.sin(radLat);
  const sqrtMagic = Math.sqrt(magic);
  return [dLon * 180 / (a / sqrtMagic * Math.cos(radLat) * Math.PI), dLat * 180 / (a * (1 - ee) / (magic * sqrtMagic) * Math.PI)];
}

function transformLat(longitude: number, latitude: number) {
  let result = -100 + 2 * longitude + 3 * latitude + 0.2 * latitude * latitude + 0.1 * longitude * latitude + 0.2 * Math.sqrt(Math.abs(longitude));
  result += (20 * Math.sin(6 * longitude * Math.PI) + 20 * Math.sin(2 * longitude * Math.PI)) * 2 / 3;
  result += (20 * Math.sin(latitude * Math.PI) + 40 * Math.sin(latitude / 3 * Math.PI)) * 2 / 3;
  return result + (160 * Math.sin(latitude / 12 * Math.PI) + 320 * Math.sin(latitude * Math.PI / 30)) * 2 / 3;
}

function transformLon(longitude: number, latitude: number) {
  let result = 300 + longitude + 2 * latitude + 0.1 * longitude * longitude + 0.1 * longitude * latitude + 0.1 * Math.sqrt(Math.abs(longitude));
  result += (20 * Math.sin(6 * longitude * Math.PI) + 20 * Math.sin(2 * longitude * Math.PI)) * 2 / 3;
  result += (20 * Math.sin(longitude * Math.PI) + 40 * Math.sin(longitude / 3 * Math.PI)) * 2 / 3;
  return result + (150 * Math.sin(longitude / 12 * Math.PI) + 300 * Math.sin(longitude / 30 * Math.PI)) * 2 / 3;
}
