import { assertPaise, type Paise } from "@methanova/shared-types";
import { GstPlaceOfSupply } from "@methanova/shared-types";
import { HttpError } from "./http.js";

export function applyBps(paise: Paise, bps: number): Paise {
  assertPaise(paise);
  if (!Number.isInteger(bps)) {
    throw new HttpError(400, "Tax basis points must be integers");
  }
  const product = paise * bps;
  if (product % 10000 !== 0) {
    throw new HttpError(400, "GST split must yield integer paise without rounding");
  }
  return product / 10000;
}

export function gstComponents(
  taxablePaise: Paise,
  place: GstPlaceOfSupply,
  rates = { cgstBps: 900, sgstBps: 900, igstBps: 1800 },
): { cgstPaise: Paise; sgstPaise: Paise; igstPaise: Paise } {
  if (place === GstPlaceOfSupply.INTER_STATE) {
    return { cgstPaise: 0, sgstPaise: 0, igstPaise: applyBps(taxablePaise, rates.igstBps) };
  }
  return {
    cgstPaise: applyBps(taxablePaise, rates.cgstBps),
    sgstPaise: applyBps(taxablePaise, rates.sgstBps),
    igstPaise: 0,
  };
}
