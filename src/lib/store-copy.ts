import type { CopyPair, Dict } from "./store-i18n/dict/types";
import { commonDict } from "./store-i18n/dict/common";
import { homeDict } from "./store-i18n/dict/home";
import { productDict } from "./store-i18n/dict/product";
import { checkoutDict } from "./store-i18n/dict/checkout";
import { orderDict } from "./store-i18n/dict/order";
import { accountDict } from "./store-i18n/dict/account";
import { miscDict } from "./store-i18n/dict/misc";

export type { CopyPair, Dict };

/** Single lookup table for every storefront UI string. */
export const STORE_COPY: Dict = {
  ...commonDict,
  ...homeDict,
  ...productDict,
  ...checkoutDict,
  ...orderDict,
  ...accountDict,
  ...miscDict,
};

export type StoreCopyKey = string;
