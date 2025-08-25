import {
  createApiKeysWorkflow,
  createCollectionsWorkflow,
  createProductCategoriesWorkflow,
  createProductsWorkflow,
  createRegionsWorkflow,
  createSalesChannelsWorkflow,
  createShippingOptionsWorkflow,
  createShippingProfilesWorkflow,
  createStockLocationsWorkflow,
  createTaxRegionsWorkflow,
  linkSalesChannelsToApiKeyWorkflow,
  linkSalesChannelsToStockLocationWorkflow,
  updateStoresWorkflow,
} from "@medusajs/core-flows";
import {
  ExecArgs,
  IFulfillmentModuleService,
  ISalesChannelModuleService,
  IStoreModuleService,
} from "@medusajs/framework/types";
import {
  ContainerRegistrationKeys,
  ModuleRegistrationName,
  Modules,
  ProductStatus,
} from "@medusajs/framework/utils";

export default async function seedDemoData({ container }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER);
  const link = container.resolve(ContainerRegistrationKeys.LINK);
  const fulfillmentModuleService: IFulfillmentModuleService = container.resolve(
    ModuleRegistrationName.FULFILLMENT
  );
  const salesChannelModuleService: ISalesChannelModuleService =
    container.resolve(ModuleRegistrationName.SALES_CHANNEL);
  const storeModuleService: IStoreModuleService = container.resolve(
    ModuleRegistrationName.STORE
  );

  const countries = ["gb", "de", "dk", "se", "fr", "es", "it"];

  logger.info("Seeding store data...");
  const [store] = await storeModuleService.listStores();
  let defaultSalesChannel = await salesChannelModuleService.listSalesChannels({
    name: "Default Sales Channel",
  });

  if (!defaultSalesChannel.length) {
    // create the default sales channel
    const { result: salesChannelResult } = await createSalesChannelsWorkflow(
      container
    ).run({
      input: {
        salesChannelsData: [
          {
            name: "Default Sales Channel",
          },
        ],
      },
    });
    defaultSalesChannel = salesChannelResult;
  }

  await updateStoresWorkflow(container).run({
    input: {
      selector: { id: store.id },
      update: {
        supported_currencies: [
          {
            currency_code: "eur",
            is_default: true,
          },
          {
            currency_code: "dkk",
          },
        ],
        default_sales_channel_id: defaultSalesChannel[0].id,
      },
    },
  });
  logger.info("Seeding region data...");
  const { result: regionResult } = await createRegionsWorkflow(container).run({
    input: {
      regions: [
        {
          name: "Europe",
          currency_code: "eur",
          countries,
          payment_providers: ["pp_system_default"],
        },
      ],
    },
  });
  const region = regionResult[0];
  logger.info("Finished seeding regions.");

  logger.info("Seeding tax regions...");
  await createTaxRegionsWorkflow(container).run({
    input: countries.map((country_code) => ({
      country_code,
    })),
  });
  logger.info("Finished seeding tax regions.");

  logger.info("Seeding stock location data...");
  const { result: stockLocationResult } = await createStockLocationsWorkflow(
    container
  ).run({
    input: {
      locations: [
        {
          name: "European Warehouse",
          address: {
            city: "Vejen",
            country_code: "DK",
            address_1: "",
          },
        },
      ],
    },
  });
  const stockLocation = stockLocationResult[0];

  await link.create({
    [Modules.STOCK_LOCATION]: {
      stock_location_id: stockLocation.id,
    },
    [Modules.FULFILLMENT]: {
      fulfillment_provider_id: "manual_manual",
    },
  });

  logger.info("Seeding fulfillment data...");
  const { result: shippingProfileResult } =
    await createShippingProfilesWorkflow(container).run({
      input: {
        data: [
          {
            name: "Default",
            type: "default",
          },
        ],
      },
    });
  const shippingProfile = shippingProfileResult[0];

  const fulfillmentSet = await fulfillmentModuleService.createFulfillmentSets({
    name: "European Warehouse delivery",
    type: "shipping",
    service_zones: [
      {
        name: "Europe",
        geo_zones: [
          {
            country_code: "gb",
            type: "country",
          },
          {
            country_code: "de",
            type: "country",
          },
          {
            country_code: "dk",
            type: "country",
          },
          {
            country_code: "se",
            type: "country",
          },
          {
            country_code: "fr",
            type: "country",
          },
          {
            country_code: "es",
            type: "country",
          },
          {
            country_code: "it",
            type: "country",
          },
        ],
      },
    ],
  });

  await link.create({
    [Modules.STOCK_LOCATION]: {
      stock_location_id: stockLocation.id,
    },
    [Modules.FULFILLMENT]: {
      fulfillment_set_id: fulfillmentSet.id,
    },
  });

  await createShippingOptionsWorkflow(container).run({
    input: [
      {
        name: "Standard Shipping",
        price_type: "flat",
        provider_id: "manual_manual",
        service_zone_id: fulfillmentSet.service_zones[0].id,
        shipping_profile_id: shippingProfile.id,
        type: {
          label: "Standard",
          description: "Ship in 2-3 days.",
          code: "standard",
        },
        prices: [
          {
            currency_code: "usd",
            amount: 10,
          },
          {
            currency_code: "eur",
            amount: 10,
          },
          {
            region_id: region.id,
            amount: 10,
          },
        ],
        rules: [
          {
            attribute: "enabled_in_store",
            value: '"true"',
            operator: "eq",
          },
          {
            attribute: "is_return",
            value: "false",
            operator: "eq",
          },
        ],
      },
      {
        name: "Express Shipping",
        price_type: "flat",
        provider_id: "manual_manual",
        service_zone_id: fulfillmentSet.service_zones[0].id,
        shipping_profile_id: shippingProfile.id,
        type: {
          label: "Express",
          description: "Ship in 24 hours.",
          code: "express",
        },
        prices: [
          {
            currency_code: "usd",
            amount: 10,
          },
          {
            currency_code: "eur",
            amount: 10,
          },
          {
            region_id: region.id,
            amount: 10,
          },
        ],
        rules: [
          {
            attribute: "enabled_in_store",
            value: '"true"',
            operator: "eq",
          },
          {
            attribute: "is_return",
            value: "false",
            operator: "eq",
          },
        ],
      },
    ],
  });
  logger.info("Finished seeding fulfillment data.");

  await linkSalesChannelsToStockLocationWorkflow(container).run({
    input: {
      id: stockLocation.id,
      add: [defaultSalesChannel[0].id],
    },
  });
  logger.info("Finished seeding stock location data.");

  logger.info("Seeding publishable API key data...");
  const { result: publishableApiKeyResult } = await createApiKeysWorkflow(
    container
  ).run({
    input: {
      api_keys: [
        {
          title: "Webshop",
          type: "publishable",
          created_by: "",
        },
      ],
    },
  });
  const publishableApiKey = publishableApiKeyResult[0];

  await linkSalesChannelsToApiKeyWorkflow(container).run({
    input: {
      id: publishableApiKey.id,
      add: [defaultSalesChannel[0].id],
    },
  });
  logger.info("Finished seeding publishable API key data.");

  logger.info("Seeding product data...");

  const {
    result: [collection],
  } = await createCollectionsWorkflow(container).run({
    input: {
      collections: [
        {
          title: "Featured",
          handle: "featured",
        },
      ],
    },
  });

  const { result: categoryResult } = await createProductCategoriesWorkflow(
    container
  ).run({
    input: {
      product_categories: [
        {
          name: "Reservedele",
          is_active: true,
        },
      ],
    },
  });

  await createProductsWorkflow(container).run({
    input: {
      products: [
  {
    "title": "fjernbetjening",
    "options": [
      {
        "title": "epokenr",
        "values": [
          "432242"
        ]
      }
    ],
    "sales_channels": [
      {
        "id": defaultSalesChannel[0].id
      }
    ],
    "category_ids": [
      categoryResult.find((cat) => cat.name === "Reservedele")?.id
    ],
    "status": ProductStatus.PUBLISHED,
    "variants": [
      {
        "title": "fjernbetjening",
        "sku": "432242",
        "prices": [
          {
            "amount": 79,
            "currency_code": "eur"
          },
          {
            "amount": 850,
            "currency_code": "dkk"
          }
        ],
        "manage_inventory": false,
        "hs_code": "1",
        "options": {
          "epokenr": "432242"
        }
      }
    ]
  },
  {
    "title": "gummitylle",
    "options": [
      {
        "title": "epokenr",
        "values": [
          "83073690"
        ]
      }
    ],
    "sales_channels": [
      {
        "id": defaultSalesChannel[0].id
      }
    ],
    "category_ids": [
      categoryResult.find((cat) => cat.name === "Reservedele")?.id
    ],
    "status": ProductStatus.PUBLISHED,
    "variants": [
      {
        "title": "gummitylle",
        "sku": "83073690",
        "prices": [
          {
            "amount": 79,
            "currency_code": "eur"
          },
          {
            "amount": 850,
            "currency_code": "dkk"
          }
        ],
        "manage_inventory": false,
        "hs_code": "1",
        "options": {
          "epokenr": "83073690"
        }
      }
    ]
  },
  {
    "title": "torxskrue",
    "options": [
      {
        "title": "epokenr",
        "values": [
          "80294552"
        ]
      }
    ],
    "sales_channels": [
      {
        "id": defaultSalesChannel[0].id
      }
    ],
    "category_ids": [
      categoryResult.find((cat) => cat.name === "Reservedele")?.id
    ],
    "status": ProductStatus.PUBLISHED,
    "variants": [
      {
        "title": "torxskrue",
        "sku": "80294552",
        "prices": [
          {
            "amount": 79,
            "currency_code": "eur"
          },
          {
            "amount": 850,
            "currency_code": "dkk"
          }
        ],
        "manage_inventory": false,
        "hs_code": "2",
        "options": {
          "epokenr": "80294552"
        }
      }
    ]
  },
  {
    "title": "torxpladeskrue",
    "options": [
      {
        "title": "epokenr",
        "values": [
          "80400003"
        ]
      }
    ],
    "sales_channels": [
      {
        "id": defaultSalesChannel[0].id
      }
    ],
    "category_ids": [
      categoryResult.find((cat) => cat.name === "Reservedele")?.id
    ],
    "status": ProductStatus.PUBLISHED,
    "variants": [
      {
        "title": "torxpladeskrue",
        "sku": "80400003",
        "prices": [
          {
            "amount": 79,
            "currency_code": "eur"
          },
          {
            "amount": 850,
            "currency_code": "dkk"
          }
        ],
        "manage_inventory": false,
        "hs_code": "4",
        "options": {
          "epokenr": "80400003"
        }
      }
    ]
  },
  {
    "title": "beslag til fjernbetjening",
    "options": [
      {
        "title": "epokenr",
        "values": [
          "438595"
        ]
      }
    ],
    "sales_channels": [
      {
        "id": defaultSalesChannel[0].id
      }
    ],
    "category_ids": [
      categoryResult.find((cat) => cat.name === "Reservedele")?.id
    ],
    "status": ProductStatus.PUBLISHED,
    "variants": [
      {
        "title": "beslag til fjernbetjening",
        "sku": "438595",
        "prices": [
          {
            "amount": 79,
            "currency_code": "eur"
          },
          {
            "amount": 850,
            "currency_code": "dkk"
          }
        ],
        "manage_inventory": false,
        "hs_code": "1",
        "options": {
          "epokenr": "438595"
        }
      }
    ]
  },
  {
    "title": "svanehals kpl.",
    "options": [
      {
        "title": "epokenr",
        "values": [
          "426940"
        ]
      }
    ],
    "sales_channels": [
      {
        "id": defaultSalesChannel[0].id
      }
    ],
    "category_ids": [
      categoryResult.find((cat) => cat.name === "Reservedele")?.id
    ],
    "status": ProductStatus.PUBLISHED,
    "variants": [
      {
        "title": "svanehals kpl.",
        "sku": "426940",
        "prices": [
          {
            "amount": 79,
            "currency_code": "eur"
          },
          {
            "amount": 850,
            "currency_code": "dkk"
          }
        ],
        "manage_inventory": false,
        "hs_code": "1",
        "options": {
          "epokenr": "426940"
        }
      }
    ]
  },
  {
    "title": "beslag",
    "options": [
      {
        "title": "epokenr",
        "values": [
          "426941"
        ]
      }
    ],
    "sales_channels": [
      {
        "id": defaultSalesChannel[0].id
      }
    ],
    "category_ids": [
      categoryResult.find((cat) => cat.name === "Reservedele")?.id
    ],
    "status": ProductStatus.PUBLISHED,
    "variants": [
      {
        "title": "beslag",
        "sku": "426941",
        "prices": [
          {
            "amount": 79,
            "currency_code": "eur"
          },
          {
            "amount": 850,
            "currency_code": "dkk"
          }
        ],
        "manage_inventory": false,
        "hs_code": "1",
        "options": {
          "epokenr": "426941"
        }
      }
    ]
  },
  {
    "title": "skive, top",
    "options": [
      {
        "title": "epokenr",
        "values": [
          "430165"
        ]
      }
    ],
    "sales_channels": [
      {
        "id": defaultSalesChannel[0].id
      }
    ],
    "category_ids": [
      categoryResult.find((cat) => cat.name === "Reservedele")?.id
    ],
    "status": ProductStatus.PUBLISHED,
    "variants": [
      {
        "title": "skive, top",
        "sku": "430165",
        "prices": [
          {
            "amount": 79,
            "currency_code": "eur"
          },
          {
            "amount": 850,
            "currency_code": "dkk"
          }
        ],
        "manage_inventory": false,
        "hs_code": "1",
        "options": {
          "epokenr": "430165"
        }
      }
    ]
  },
  {
    "title": "skive, mellem",
    "options": [
      {
        "title": "epokenr",
        "values": [
          "430166"
        ]
      }
    ],
    "sales_channels": [
      {
        "id": defaultSalesChannel[0].id
      }
    ],
    "category_ids": [
      categoryResult.find((cat) => cat.name === "Reservedele")?.id
    ],
    "status": ProductStatus.PUBLISHED,
    "variants": [
      {
        "title": "skive, mellem",
        "sku": "430166",
        "prices": [
          {
            "amount": 79,
            "currency_code": "eur"
          },
          {
            "amount": 850,
            "currency_code": "dkk"
          }
        ],
        "manage_inventory": false,
        "hs_code": "1",
        "options": {
          "epokenr": "430166"
        }
      }
    ]
  },
  {
    "title": "beslag, vinkel",
    "options": [
      {
        "title": "epokenr",
        "values": [
          "430167"
        ]
      }
    ],
    "sales_channels": [
      {
        "id": defaultSalesChannel[0].id
      }
    ],
    "category_ids": [
      categoryResult.find((cat) => cat.name === "Reservedele")?.id
    ],
    "status": ProductStatus.PUBLISHED,
    "variants": [
      {
        "title": "beslag, vinkel",
        "sku": "430167",
        "prices": [
          {
            "amount": 79,
            "currency_code": "eur"
          },
          {
            "amount": 850,
            "currency_code": "dkk"
          }
        ],
        "manage_inventory": false,
        "hs_code": "1",
        "options": {
          "epokenr": "430167"
        }
      }
    ]
  },
  {
    "title": "gevindskive",
    "options": [
      {
        "title": "epokenr",
        "values": [
          "430168"
        ]
      }
    ],
    "sales_channels": [
      {
        "id": defaultSalesChannel[0].id
      }
    ],
    "category_ids": [
      categoryResult.find((cat) => cat.name === "Reservedele")?.id
    ],
    "status": ProductStatus.PUBLISHED,
    "variants": [
      {
        "title": "gevindskive",
        "sku": "430168",
        "prices": [
          {
            "amount": 79,
            "currency_code": "eur"
          },
          {
            "amount": 850,
            "currency_code": "dkk"
          }
        ],
        "manage_inventory": false,
        "hs_code": "1",
        "options": {
          "epokenr": "430168"
        }
      }
    ]
  },
  {
    "title": "beslag, lige",
    "options": [
      {
        "title": "epokenr",
        "values": [
          "430169"
        ]
      }
    ],
    "sales_channels": [
      {
        "id": defaultSalesChannel[0].id
      }
    ],
    "category_ids": [
      categoryResult.find((cat) => cat.name === "Reservedele")?.id
    ],
    "status": ProductStatus.PUBLISHED,
    "variants": [
      {
        "title": "beslag, lige",
        "sku": "430169",
        "prices": [
          {
            "amount": 79,
            "currency_code": "eur"
          },
          {
            "amount": 850,
            "currency_code": "dkk"
          }
        ],
        "manage_inventory": false,
        "hs_code": "1",
        "options": {
          "epokenr": "430169"
        }
      }
    ]
  },
  {
    "title": "svanehals",
    "options": [
      {
        "title": "epokenr",
        "values": [
          "430171"
        ]
      }
    ],
    "sales_channels": [
      {
        "id": defaultSalesChannel[0].id
      }
    ],
    "category_ids": [
      categoryResult.find((cat) => cat.name === "Reservedele")?.id
    ],
    "status": ProductStatus.PUBLISHED,
    "variants": [
      {
        "title": "svanehals",
        "sku": "430171",
        "prices": [
          {
            "amount": 79,
            "currency_code": "eur"
          },
          {
            "amount": 850,
            "currency_code": "dkk"
          }
        ],
        "manage_inventory": false,
        "hs_code": "1",
        "options": {
          "epokenr": "430171"
        }
      }
    ]
  },
  {
    "title": "cylinderskrue",
    "options": [
      {
        "title": "epokenr",
        "values": [
          "80333217"
        ]
      }
    ],
    "sales_channels": [
      {
        "id": defaultSalesChannel[0].id
      }
    ],
    "category_ids": [
      categoryResult.find((cat) => cat.name === "Reservedele")?.id
    ],
    "status": ProductStatus.PUBLISHED,
    "variants": [
      {
        "title": "cylinderskrue",
        "sku": "80333217",
        "prices": [
          {
            "amount": 79,
            "currency_code": "eur"
          },
          {
            "amount": 850,
            "currency_code": "dkk"
          }
        ],
        "manage_inventory": false,
        "hs_code": "2",
        "options": {
          "epokenr": "80333217"
        }
      }
    ]
  },
  {
    "title": "holder han-part",
    "options": [
      {
        "title": "epokenr",
        "values": [
          "408381"
        ]
      }
    ],
    "sales_channels": [
      {
        "id": defaultSalesChannel[0].id
      }
    ],
    "category_ids": [
      categoryResult.find((cat) => cat.name === "Reservedele")?.id
    ],
    "status": ProductStatus.PUBLISHED,
    "variants": [
      {
        "title": "holder han-part",
        "sku": "408381",
        "prices": [
          {
            "amount": 79,
            "currency_code": "eur"
          },
          {
            "amount": 850,
            "currency_code": "dkk"
          }
        ],
        "manage_inventory": false,
        "hs_code": "1",
        "options": {
          "epokenr": "408381"
        }
      }
    ]
  },
  {
    "title": "holder hun-part",
    "options": [
      {
        "title": "epokenr",
        "values": [
          "408382"
        ]
      }
    ],
    "sales_channels": [
      {
        "id": defaultSalesChannel[0].id
      }
    ],
    "category_ids": [
      categoryResult.find((cat) => cat.name === "Reservedele")?.id
    ],
    "status": ProductStatus.PUBLISHED,
    "variants": [
      {
        "title": "holder hun-part",
        "sku": "408382",
        "prices": [
          {
            "amount": 79,
            "currency_code": "eur"
          },
          {
            "amount": 850,
            "currency_code": "dkk"
          }
        ],
        "manage_inventory": false,
        "hs_code": "1",
        "options": {
          "epokenr": "408382"
        }
      }
    ]
  },
  {
    "title": "monteringssæt, standard",
    "options": [
      {
        "title": "epokenr",
        "values": [
          "432243"
        ]
      }
    ],
    "sales_channels": [
      {
        "id": defaultSalesChannel[0].id
      }
    ],
    "category_ids": [
      categoryResult.find((cat) => cat.name === "Reservedele")?.id
    ],
    "status": ProductStatus.PUBLISHED,
    "variants": [
      {
        "title": "monteringssæt, standard",
        "sku": "432243",
        "prices": [
          {
            "amount": 79,
            "currency_code": "eur"
          },
          {
            "amount": 850,
            "currency_code": "dkk"
          }
        ],
        "manage_inventory": false,
        "hs_code": "1",
        "options": {
          "epokenr": "432243"
        }
      }
    ]
  },
  {
    "title": "indsats, hun",
    "options": [
      {
        "title": "epokenr",
        "values": [
          "83058329"
        ]
      }
    ],
    "sales_channels": [
      {
        "id": defaultSalesChannel[0].id
      }
    ],
    "category_ids": [
      categoryResult.find((cat) => cat.name === "Reservedele")?.id
    ],
    "status": ProductStatus.PUBLISHED,
    "variants": [
      {
        "title": "indsats, hun",
        "sku": "83058329",
        "prices": [
          {
            "amount": 79,
            "currency_code": "eur"
          },
          {
            "amount": 850,
            "currency_code": "dkk"
          }
        ],
        "manage_inventory": false,
        "hs_code": "2",
        "options": {
          "epokenr": "83058329"
        }
      }
    ]
  },
  {
    "title": "indsats, han",
    "options": [
      {
        "title": "epokenr",
        "values": [
          "83058330"
        ]
      }
    ],
    "sales_channels": [
      {
        "id": defaultSalesChannel[0].id
      }
    ],
    "category_ids": [
      categoryResult.find((cat) => cat.name === "Reservedele")?.id
    ],
    "status": ProductStatus.PUBLISHED,
    "variants": [
      {
        "title": "indsats, han",
        "sku": "83058330",
        "prices": [
          {
            "amount": 79,
            "currency_code": "eur"
          },
          {
            "amount": 850,
            "currency_code": "dkk"
          }
        ],
        "manage_inventory": false,
        "hs_code": "1",
        "options": {
          "epokenr": "83058330"
        }
      }
    ]
  },
  {
    "title": "sokkelhus, vinkel",
    "options": [
      {
        "title": "epokenr",
        "values": [
          "83058334"
        ]
      }
    ],
    "sales_channels": [
      {
        "id": defaultSalesChannel[0].id
      }
    ],
    "category_ids": [
      categoryResult.find((cat) => cat.name === "Reservedele")?.id
    ],
    "status": ProductStatus.PUBLISHED,
    "variants": [
      {
        "title": "sokkelhus, vinkel",
        "sku": "83058334",
        "prices": [
          {
            "amount": 79,
            "currency_code": "eur"
          },
          {
            "amount": 850,
            "currency_code": "dkk"
          }
        ],
        "manage_inventory": false,
        "hs_code": "1",
        "options": {
          "epokenr": "83058334"
        }
      }
    ]
  },
  {
    "title": "sokkelhus, lige",
    "options": [
      {
        "title": "epokenr",
        "values": [
          "83058335"
        ]
      }
    ],
    "sales_channels": [
      {
        "id": defaultSalesChannel[0].id
      }
    ],
    "category_ids": [
      categoryResult.find((cat) => cat.name === "Reservedele")?.id
    ],
    "status": ProductStatus.PUBLISHED,
    "variants": [
      {
        "title": "sokkelhus, lige",
        "sku": "83058335",
        "prices": [
          {
            "amount": 79,
            "currency_code": "eur"
          },
          {
            "amount": 850,
            "currency_code": "dkk"
          }
        ],
        "manage_inventory": false,
        "hs_code": "1",
        "options": {
          "epokenr": "83058335"
        }
      }
    ]
  },
  {
    "title": "kabelforskruning",
    "options": [
      {
        "title": "epokenr",
        "values": [
          "83079432"
        ]
      }
    ],
    "sales_channels": [
      {
        "id": defaultSalesChannel[0].id
      }
    ],
    "category_ids": [
      categoryResult.find((cat) => cat.name === "Reservedele")?.id
    ],
    "status": ProductStatus.PUBLISHED,
    "variants": [
      {
        "title": "kabelforskruning",
        "sku": "83079432",
        "prices": [
          {
            "amount": 79,
            "currency_code": "eur"
          },
          {
            "amount": 850,
            "currency_code": "dkk"
          }
        ],
        "manage_inventory": false,
        "hs_code": "2",
        "options": {
          "epokenr": "83079432"
        }
      }
    ]
  },
  {
    "title": "sikring",
    "options": [
      {
        "title": "epokenr",
        "values": [
          "83145464"
        ]
      }
    ],
    "sales_channels": [
      {
        "id": defaultSalesChannel[0].id
      }
    ],
    "category_ids": [
      categoryResult.find((cat) => cat.name === "Reservedele")?.id
    ],
    "status": ProductStatus.PUBLISHED,
    "variants": [
      {
        "title": "sikring",
        "sku": "83145464",
        "prices": [
          {
            "amount": 79,
            "currency_code": "eur"
          },
          {
            "amount": 850,
            "currency_code": "dkk"
          }
        ],
        "manage_inventory": false,
        "hs_code": "1",
        "options": {
          "epokenr": "83145464"
        }
      }
    ]
  },
  {
    "title": "L= 6m.",
    "options": [
      {
        "title": "epokenr",
        "values": [
          "440117"
        ]
      }
    ],
    "sales_channels": [
      {
        "id": defaultSalesChannel[0].id
      }
    ],
    "category_ids": [
      categoryResult.find((cat) => cat.name === "Reservedele")?.id
    ],
    "status": ProductStatus.PUBLISHED,
    "variants": [
      {
        "title": "L= 6m.",
        "sku": "440117",
        "prices": [
          {
            "amount": 79,
            "currency_code": "eur"
          },
          {
            "amount": 850,
            "currency_code": "dkk"
          }
        ],
        "manage_inventory": false,
        "hs_code": "1",
        "options": {
          "epokenr": "440117"
        }
      }
    ]
  },
  {
    "title": "L=13 m.",
    "options": [
      {
        "title": "epokenr",
        "values": [
          "430381"
        ]
      }
    ],
    "sales_channels": [
      {
        "id": defaultSalesChannel[0].id
      }
    ],
    "category_ids": [
      categoryResult.find((cat) => cat.name === "Reservedele")?.id
    ],
    "status": ProductStatus.PUBLISHED,
    "variants": [
      {
        "title": "L=13 m.",
        "sku": "430381",
        "prices": [
          {
            "amount": 79,
            "currency_code": "eur"
          },
          {
            "amount": 850,
            "currency_code": "dkk"
          }
        ],
        "manage_inventory": false,
        "hs_code": "1",
        "options": {
          "epokenr": "430381"
        }
      }
    ]
  },
  {
    "title": "induktiv aftaster",
    "options": [
      {
        "title": "epokenr",
        "values": [
          "421844"
        ]
      }
    ],
    "sales_channels": [
      {
        "id": defaultSalesChannel[0].id
      }
    ],
    "category_ids": [
      categoryResult.find((cat) => cat.name === "Reservedele")?.id
    ],
    "status": ProductStatus.PUBLISHED,
    "variants": [
      {
        "title": "induktiv aftaster",
        "sku": "421844",
        "prices": [
          {
            "amount": 79,
            "currency_code": "eur"
          },
          {
            "amount": 850,
            "currency_code": "dkk"
          }
        ],
        "manage_inventory": false,
        "hs_code": "1",
        "options": {
          "epokenr": "421844"
        }
      }
    ]
  },
  {
    "title": "induktiv hjul aftaster",
    "options": [
      {
        "title": "epokenr",
        "values": [
          "423584"
        ]
      }
    ],
    "sales_channels": [
      {
        "id": defaultSalesChannel[0].id
      }
    ],
    "category_ids": [
      categoryResult.find((cat) => cat.name === "Reservedele")?.id
    ],
    "status": ProductStatus.PUBLISHED,
    "variants": [
      {
        "title": "induktiv hjul aftaster",
        "sku": "423584",
        "prices": [
          {
            "amount": 79,
            "currency_code": "eur"
          },
          {
            "amount": 850,
            "currency_code": "dkk"
          }
        ],
        "manage_inventory": false,
        "hs_code": "1",
        "options": {
          "epokenr": "423584"
        }
      }
    ]
  },
  {
    "title": "plade for el-stik",
    "options": [
      {
        "title": "epokenr",
        "values": [
          "429516"
        ]
      }
    ],
    "sales_channels": [
      {
        "id": defaultSalesChannel[0].id
      }
    ],
    "category_ids": [
      categoryResult.find((cat) => cat.name === "Reservedele")?.id
    ],
    "status": ProductStatus.PUBLISHED,
    "variants": [
      {
        "title": "plade for el-stik",
        "sku": "429516",
        "prices": [
          {
            "amount": 79,
            "currency_code": "eur"
          },
          {
            "amount": 850,
            "currency_code": "dkk"
          }
        ],
        "manage_inventory": false,
        "hs_code": "1",
        "options": {
          "epokenr": "429516"
        }
      }
    ]
  },
  {
    "title": "computer unit box",
    "options": [
      {
        "title": "epokenr",
        "values": [
          "440119"
        ]
      }
    ],
    "sales_channels": [
      {
        "id": defaultSalesChannel[0].id
      }
    ],
    "category_ids": [
      categoryResult.find((cat) => cat.name === "Reservedele")?.id
    ],
    "status": ProductStatus.PUBLISHED,
    "variants": [
      {
        "title": "computer unit box",
        "sku": "440119",
        "prices": [
          {
            "amount": 79,
            "currency_code": "eur"
          },
          {
            "amount": 850,
            "currency_code": "dkk"
          }
        ],
        "manage_inventory": false,
        "hs_code": "1",
        "options": {
          "epokenr": "440119"
        }
      }
    ]
  },
  {
    "title": "kontakt S/S",
    "options": [
      {
        "title": "epokenr",
        "values": [
          "435574"
        ]
      }
    ],
    "sales_channels": [
      {
        "id": defaultSalesChannel[0].id
      }
    ],
    "category_ids": [
      categoryResult.find((cat) => cat.name === "Reservedele")?.id
    ],
    "status": ProductStatus.PUBLISHED,
    "variants": [
      {
        "title": "kontakt S/S",
        "sku": "435574",
        "prices": [
          {
            "amount": 79,
            "currency_code": "eur"
          },
          {
            "amount": 850,
            "currency_code": "dkk"
          }
        ],
        "manage_inventory": false,
        "hs_code": "1",
        "options": {
          "epokenr": "435574"
        }
      }
    ]
  },
  {
    "title": "print, driver",
    "options": [
      {
        "title": "epokenr",
        "values": [
          "440094"
        ]
      }
    ],
    "sales_channels": [
      {
        "id": defaultSalesChannel[0].id
      }
    ],
    "category_ids": [
      categoryResult.find((cat) => cat.name === "Reservedele")?.id
    ],
    "status": ProductStatus.PUBLISHED,
    "variants": [
      {
        "title": "print, driver",
        "sku": "440094",
        "prices": [
          {
            "amount": 79,
            "currency_code": "eur"
          },
          {
            "amount": 850,
            "currency_code": "dkk"
          }
        ],
        "manage_inventory": false,
        "hs_code": "2",
        "options": {
          "epokenr": "440094"
        }
      }
    ]
  },
  {
    "title": "print, PWM",
    "options": [
      {
        "title": "epokenr",
        "values": [
          "440075"
        ]
      }
    ],
    "sales_channels": [
      {
        "id": defaultSalesChannel[0].id
      }
    ],
    "category_ids": [
      categoryResult.find((cat) => cat.name === "Reservedele")?.id
    ],
    "status": ProductStatus.PUBLISHED,
    "variants": [
      {
        "title": "print, PWM",
        "sku": "440075",
        "prices": [
          {
            "amount": 79,
            "currency_code": "eur"
          },
          {
            "amount": 850,
            "currency_code": "dkk"
          }
        ],
        "manage_inventory": false,
        "hs_code": "1",
        "options": {
          "epokenr": "440075"
        }
      }
    ]
  },
  {
    "title": "reset-knap kpl.",
    "options": [
      {
        "title": "epokenr",
        "values": [
          "439009"
        ]
      }
    ],
    "sales_channels": [
      {
        "id": defaultSalesChannel[0].id
      }
    ],
    "category_ids": [
      categoryResult.find((cat) => cat.name === "Reservedele")?.id
    ],
    "status": ProductStatus.PUBLISHED,
    "variants": [
      {
        "title": "reset-knap kpl.",
        "sku": "439009",
        "prices": [
          {
            "amount": 79,
            "currency_code": "eur"
          },
          {
            "amount": 850,
            "currency_code": "dkk"
          }
        ],
        "manage_inventory": false,
        "hs_code": "1",
        "options": {
          "epokenr": "439009"
        }
      }
    ]
  },
  {
    "title": "print, sikkerhedsstop",
    "options": [
      {
        "title": "epokenr",
        "values": [
          "440071"
        ]
      }
    ],
    "sales_channels": [
      {
        "id": defaultSalesChannel[0].id
      }
    ],
    "category_ids": [
      categoryResult.find((cat) => cat.name === "Reservedele")?.id
    ],
    "status": ProductStatus.PUBLISHED,
    "variants": [
      {
        "title": "print, sikkerhedsstop",
        "sku": "440071",
        "prices": [
          {
            "amount": 79,
            "currency_code": "eur"
          },
          {
            "amount": 850,
            "currency_code": "dkk"
          }
        ],
        "manage_inventory": false,
        "hs_code": "1",
        "options": {
          "epokenr": "440071"
        }
      }
    ]
  },
  {
    "title": "bundprint",
    "options": [
      {
        "title": "epokenr",
        "values": [
          "440086"
        ]
      }
    ],
    "sales_channels": [
      {
        "id": defaultSalesChannel[0].id
      }
    ],
    "category_ids": [
      categoryResult.find((cat) => cat.name === "Reservedele")?.id
    ],
    "status": ProductStatus.PUBLISHED,
    "variants": [
      {
        "title": "bundprint",
        "sku": "440086",
        "prices": [
          {
            "amount": 79,
            "currency_code": "eur"
          },
          {
            "amount": 850,
            "currency_code": "dkk"
          }
        ],
        "manage_inventory": false,
        "hs_code": "1",
        "options": {
          "epokenr": "440086"
        }
      }
    ]
  },
  {
    "title": "holder f. W-bundprint",
    "options": [
      {
        "title": "epokenr",
        "values": [
          "439321"
        ]
      }
    ],
    "sales_channels": [
      {
        "id": defaultSalesChannel[0].id
      }
    ],
    "category_ids": [
      categoryResult.find((cat) => cat.name === "Reservedele")?.id
    ],
    "status": ProductStatus.PUBLISHED,
    "variants": [
      {
        "title": "holder f. W-bundprint",
        "sku": "439321",
        "prices": [
          {
            "amount": 79,
            "currency_code": "eur"
          },
          {
            "amount": 850,
            "currency_code": "dkk"
          }
        ],
        "manage_inventory": false,
        "hs_code": "1",
        "options": {
          "epokenr": "439321"
        }
      }
    ]
  },
  {
    "title": "print, CPU",
    "options": [
      {
        "title": "epokenr",
        "values": [
          "440090"
        ]
      }
    ],
    "sales_channels": [
      {
        "id": defaultSalesChannel[0].id
      }
    ],
    "category_ids": [
      categoryResult.find((cat) => cat.name === "Reservedele")?.id
    ],
    "status": ProductStatus.PUBLISHED,
    "variants": [
      {
        "title": "print, CPU",
        "sku": "440090",
        "prices": [
          {
            "amount": 79,
            "currency_code": "eur"
          },
          {
            "amount": 850,
            "currency_code": "dkk"
          }
        ],
        "manage_inventory": false,
        "hs_code": "1",
        "options": {
          "epokenr": "440090"
        }
      }
    ]
  },
  {
    "title": "kabelgennemføring",
    "options": [
      {
        "title": "epokenr",
        "values": [
          "509071"
        ]
      }
    ],
    "sales_channels": [
      {
        "id": defaultSalesChannel[0].id
      }
    ],
    "category_ids": [
      categoryResult.find((cat) => cat.name === "Reservedele")?.id
    ],
    "status": ProductStatus.PUBLISHED,
    "variants": [
      {
        "title": "kabelgennemføring",
        "sku": "509071",
        "prices": [
          {
            "amount": 79,
            "currency_code": "eur"
          },
          {
            "amount": 850,
            "currency_code": "dkk"
          }
        ],
        "manage_inventory": false,
        "hs_code": "1",
        "options": {
          "epokenr": "509071"
        }
      }
    ]
  },
  {
    "title": "selvlåsende møtrik",
    "options": [
      {
        "title": "epokenr",
        "values": [
          "80564293"
        ]
      }
    ],
    "sales_channels": [
      {
        "id": defaultSalesChannel[0].id
      }
    ],
    "category_ids": [
      categoryResult.find((cat) => cat.name === "Reservedele")?.id
    ],
    "status": ProductStatus.PUBLISHED,
    "variants": [
      {
        "title": "selvlåsende møtrik",
        "sku": "80564293",
        "prices": [
          {
            "amount": 79,
            "currency_code": "eur"
          },
          {
            "amount": 850,
            "currency_code": "dkk"
          }
        ],
        "manage_inventory": false,
        "hs_code": "4",
        "options": {
          "epokenr": "80564293"
        }
      }
    ]
  },
  {
    "title": "fjederskive",
    "options": [
      {
        "title": "epokenr",
        "values": [
          "80653652"
        ]
      }
    ],
    "sales_channels": [
      {
        "id": defaultSalesChannel[0].id
      }
    ],
    "category_ids": [
      categoryResult.find((cat) => cat.name === "Reservedele")?.id
    ],
    "status": ProductStatus.PUBLISHED,
    "variants": [
      {
        "title": "fjederskive",
        "sku": "80653652",
        "prices": [
          {
            "amount": 79,
            "currency_code": "eur"
          },
          {
            "amount": 850,
            "currency_code": "dkk"
          }
        ],
        "manage_inventory": false,
        "hs_code": "2",
        "options": {
          "epokenr": "80653652"
        }
      }
    ]
  },
  {
    "title": "støvhætte",
    "options": [
      {
        "title": "epokenr",
        "values": [
          "83008258"
        ]
      }
    ],
    "sales_channels": [
      {
        "id": defaultSalesChannel[0].id
      }
    ],
    "category_ids": [
      categoryResult.find((cat) => cat.name === "Reservedele")?.id
    ],
    "status": ProductStatus.PUBLISHED,
    "variants": [
      {
        "title": "støvhætte",
        "sku": "83008258",
        "prices": [
          {
            "amount": 79,
            "currency_code": "eur"
          },
          {
            "amount": 850,
            "currency_code": "dkk"
          }
        ],
        "manage_inventory": false,
        "hs_code": "1",
        "options": {
          "epokenr": "83008258"
        }
      }
    ]
  },
  {
    "title": "ringetryk, grøn",
    "options": [
      {
        "title": "epokenr",
        "values": [
          "83008885"
        ]
      }
    ],
    "sales_channels": [
      {
        "id": defaultSalesChannel[0].id
      }
    ],
    "category_ids": [
      categoryResult.find((cat) => cat.name === "Reservedele")?.id
    ],
    "status": ProductStatus.PUBLISHED,
    "variants": [
      {
        "title": "ringetryk, grøn",
        "sku": "83008885",
        "prices": [
          {
            "amount": 79,
            "currency_code": "eur"
          },
          {
            "amount": 850,
            "currency_code": "dkk"
          }
        ],
        "manage_inventory": false,
        "hs_code": "1",
        "options": {
          "epokenr": "83008885"
        }
      }
    ]
  },
  {
    "title": "ringetryk, rød",
    "options": [
      {
        "title": "epokenr",
        "values": [
          "83008884"
        ]
      }
    ],
    "sales_channels": [
      {
        "id": defaultSalesChannel[0].id
      }
    ],
    "category_ids": [
      categoryResult.find((cat) => cat.name === "Reservedele")?.id
    ],
    "status": ProductStatus.PUBLISHED,
    "variants": [
      {
        "title": "ringetryk, rød",
        "sku": "83008884",
        "prices": [
          {
            "amount": 79,
            "currency_code": "eur"
          },
          {
            "amount": 850,
            "currency_code": "dkk"
          }
        ],
        "manage_inventory": false,
        "hs_code": "1",
        "options": {
          "epokenr": "83008884"
        }
      }
    ]
  },
  {
    "title": "sokkelhus m.dæksel",
    "options": [
      {
        "title": "epokenr",
        "values": [
          "83058333"
        ]
      }
    ],
    "sales_channels": [
      {
        "id": defaultSalesChannel[0].id
      }
    ],
    "category_ids": [
      categoryResult.find((cat) => cat.name === "Reservedele")?.id
    ],
    "status": ProductStatus.PUBLISHED,
    "variants": [
      {
        "title": "sokkelhus m.dæksel",
        "sku": "83058333",
        "prices": [
          {
            "amount": 79,
            "currency_code": "eur"
          },
          {
            "amount": 850,
            "currency_code": "dkk"
          }
        ],
        "manage_inventory": false,
        "hs_code": "1",
        "options": {
          "epokenr": "83058333"
        }
      }
    ]
  },
  {
    "title": "samledåse",
    "options": [
      {
        "title": "epokenr",
        "values": [
          "83092209"
        ]
      }
    ],
    "sales_channels": [
      {
        "id": defaultSalesChannel[0].id
      }
    ],
    "category_ids": [
      categoryResult.find((cat) => cat.name === "Reservedele")?.id
    ],
    "status": ProductStatus.PUBLISHED,
    "variants": [
      {
        "title": "samledåse",
        "sku": "83092209",
        "prices": [
          {
            "amount": 79,
            "currency_code": "eur"
          },
          {
            "amount": 850,
            "currency_code": "dkk"
          }
        ],
        "manage_inventory": false,
        "hs_code": "1",
        "options": {
          "epokenr": "83092209"
        }
      }
    ]
  },
  {
    "title": "ledning for induktiv føler",
    "options": [
      {
        "title": "epokenr",
        "values": [
          "83089896"
        ]
      }
    ],
    "sales_channels": [
      {
        "id": defaultSalesChannel[0].id
      }
    ],
    "category_ids": [
      categoryResult.find((cat) => cat.name === "Reservedele")?.id
    ],
    "status": ProductStatus.PUBLISHED,
    "variants": [
      {
        "title": "ledning for induktiv føler",
        "sku": "83089896",
        "prices": [
          {
            "amount": 79,
            "currency_code": "eur"
          },
          {
            "amount": 850,
            "currency_code": "dkk"
          }
        ],
        "manage_inventory": false,
        "hs_code": "1",
        "options": {
          "epokenr": "83089896"
        }
      }
    ]
  },
  {
    "title": "styreenhed kpl. SH3810",
    "options": [
      {
        "title": "epokenr",
        "values": [
          "440645"
        ]
      }
    ],
    "sales_channels": [
      {
        "id": defaultSalesChannel[0].id
      }
    ],
    "category_ids": [
      categoryResult.find((cat) => cat.name === "Reservedele")?.id
    ],
    "status": ProductStatus.PUBLISHED,
    "variants": [
      {
        "title": "styreenhed kpl. SH3810",
        "sku": "440645",
        "prices": [
          {
            "amount": 79,
            "currency_code": "eur"
          },
          {
            "amount": 850,
            "currency_code": "dkk"
          }
        ],
        "manage_inventory": false,
        "hs_code": "1",
        "options": {
          "epokenr": "440645"
        }
      }
    ]
  },
  {
    "title": "styreenhed kpl. SE3810",
    "options": [
      {
        "title": "epokenr",
        "values": [
          "440646"
        ]
      }
    ],
    "sales_channels": [
      {
        "id": defaultSalesChannel[0].id
      }
    ],
    "category_ids": [
      categoryResult.find((cat) => cat.name === "Reservedele")?.id
    ],
    "status": ProductStatus.PUBLISHED,
    "variants": [
      {
        "title": "styreenhed kpl. SE3810",
        "sku": "440646",
        "prices": [
          {
            "amount": 79,
            "currency_code": "eur"
          },
          {
            "amount": 850,
            "currency_code": "dkk"
          }
        ],
        "manage_inventory": false,
        "hs_code": "1",
        "options": {
          "epokenr": "440646"
        }
      }
    ]
  },
  {
    "title": "styreenhed kpl. SW3810",
    "options": [
      {
        "title": "epokenr",
        "values": [
          "440647"
        ]
      }
    ],
    "sales_channels": [
      {
        "id": defaultSalesChannel[0].id
      }
    ],
    "category_ids": [
      categoryResult.find((cat) => cat.name === "Reservedele")?.id
    ],
    "status": ProductStatus.PUBLISHED,
    "variants": [
      {
        "title": "styreenhed kpl. SW3810",
        "sku": "440647",
        "prices": [
          {
            "amount": 79,
            "currency_code": "eur"
          },
          {
            "amount": 850,
            "currency_code": "dkk"
          }
        ],
        "manage_inventory": false,
        "hs_code": "1",
        "options": {
          "epokenr": "440647"
        }
      }
    ]
  },
  {
    "title": "ledningssæt SH3810",
    "options": [
      {
        "title": "epokenr",
        "values": [
          "440654"
        ]
      }
    ],
    "sales_channels": [
      {
        "id": defaultSalesChannel[0].id
      }
    ],
    "category_ids": [
      categoryResult.find((cat) => cat.name === "Reservedele")?.id
    ],
    "status": ProductStatus.PUBLISHED,
    "variants": [
      {
        "title": "ledningssæt SH3810",
        "sku": "440654",
        "prices": [
          {
            "amount": 79,
            "currency_code": "eur"
          },
          {
            "amount": 850,
            "currency_code": "dkk"
          }
        ],
        "manage_inventory": false,
        "hs_code": "1",
        "options": {
          "epokenr": "440654"
        }
      }
    ]
  },
  {
    "title": "ledningssæt SE3810",
    "options": [
      {
        "title": "epokenr",
        "values": [
          "440655"
        ]
      }
    ],
    "sales_channels": [
      {
        "id": defaultSalesChannel[0].id
      }
    ],
    "category_ids": [
      categoryResult.find((cat) => cat.name === "Reservedele")?.id
    ],
    "status": ProductStatus.PUBLISHED,
    "variants": [
      {
        "title": "ledningssæt SE3810",
        "sku": "440655",
        "prices": [
          {
            "amount": 79,
            "currency_code": "eur"
          },
          {
            "amount": 850,
            "currency_code": "dkk"
          }
        ],
        "manage_inventory": false,
        "hs_code": "1",
        "options": {
          "epokenr": "440655"
        }
      }
    ]
  },
  {
    "title": "ledningssæt SW3810",
    "options": [
      {
        "title": "epokenr",
        "values": [
          "440656"
        ]
      }
    ],
    "sales_channels": [
      {
        "id": defaultSalesChannel[0].id
      }
    ],
    "category_ids": [
      categoryResult.find((cat) => cat.name === "Reservedele")?.id
    ],
    "status": ProductStatus.PUBLISHED,
    "variants": [
      {
        "title": "ledningssæt SW3810",
        "sku": "440656",
        "prices": [
          {
            "amount": 79,
            "currency_code": "eur"
          },
          {
            "amount": 850,
            "currency_code": "dkk"
          }
        ],
        "manage_inventory": false,
        "hs_code": "1",
        "options": {
          "epokenr": "440656"
        }
      }
    ]
  },
  {
    "title": "dobbelt multistik",
    "options": [
      {
        "title": "epokenr",
        "values": [
          "430380"
        ]
      }
    ],
    "sales_channels": [
      {
        "id": defaultSalesChannel[0].id
      }
    ],
    "category_ids": [
      categoryResult.find((cat) => cat.name === "Reservedele")?.id
    ],
    "status": ProductStatus.PUBLISHED,
    "variants": [
      {
        "title": "dobbelt multistik",
        "sku": "430380",
        "prices": [
          {
            "amount": 79,
            "currency_code": "eur"
          },
          {
            "amount": 850,
            "currency_code": "dkk"
          }
        ],
        "manage_inventory": false,
        "hs_code": "1",
        "options": {
          "epokenr": "430380"
        }
      }
    ]
  },
  {
    "title": "multistik, han indmad",
    "options": [
      {
        "title": "epokenr",
        "values": [
          "83053761"
        ]
      }
    ],
    "sales_channels": [
      {
        "id": defaultSalesChannel[0].id
      }
    ],
    "category_ids": [
      categoryResult.find((cat) => cat.name === "Reservedele")?.id
    ],
    "status": ProductStatus.PUBLISHED,
    "variants": [
      {
        "title": "multistik, han indmad",
        "sku": "83053761",
        "prices": [
          {
            "amount": 79,
            "currency_code": "eur"
          },
          {
            "amount": 850,
            "currency_code": "dkk"
          }
        ],
        "manage_inventory": false,
        "hs_code": "1",
        "options": {
          "epokenr": "83053761"
        }
      }
    ]
  },
  {
    "title": "multistik, indmad hun",
    "options": [
      {
        "title": "epokenr",
        "values": [
          "83053762"
        ]
      }
    ],
    "sales_channels": [
      {
        "id": defaultSalesChannel[0].id
      }
    ],
    "category_ids": [
      categoryResult.find((cat) => cat.name === "Reservedele")?.id
    ],
    "status": ProductStatus.PUBLISHED,
    "variants": [
      {
        "title": "multistik, indmad hun",
        "sku": "83053762",
        "prices": [
          {
            "amount": 79,
            "currency_code": "eur"
          },
          {
            "amount": 850,
            "currency_code": "dkk"
          }
        ],
        "manage_inventory": false,
        "hs_code": "1",
        "options": {
          "epokenr": "83053762"
        }
      }
    ]
  },
  {
    "title": "sokkelhus",
    "options": [
      {
        "title": "epokenr",
        "values": [
          "83058012"
        ]
      }
    ],
    "sales_channels": [
      {
        "id": defaultSalesChannel[0].id
      }
    ],
    "category_ids": [
      categoryResult.find((cat) => cat.name === "Reservedele")?.id
    ],
    "status": ProductStatus.PUBLISHED,
    "variants": [
      {
        "title": "sokkelhus",
        "sku": "83058012",
        "prices": [
          {
            "amount": 79,
            "currency_code": "eur"
          },
          {
            "amount": 850,
            "currency_code": "dkk"
          }
        ],
        "manage_inventory": false,
        "hs_code": "1",
        "options": {
          "epokenr": "83058012"
        }
      }
    ]
  },
  {
    "title": "skærm",
    "options": [
      {
        "title": "epokenr",
        "values": [
          "203862"
        ]
      }
    ],
    "sales_channels": [
      {
        "id": defaultSalesChannel[0].id
      }
    ],
    "category_ids": [
      categoryResult.find((cat) => cat.name === "Reservedele")?.id
    ],
    "status": ProductStatus.PUBLISHED,
    "variants": [
      {
        "title": "skærm",
        "sku": "203862",
        "prices": [
          {
            "amount": 79,
            "currency_code": "eur"
          },
          {
            "amount": 850,
            "currency_code": "dkk"
          }
        ],
        "manage_inventory": false,
        "hs_code": "1",
        "options": {
          "epokenr": "203862"
        }
      }
    ]
  },
  {
    "title": "kugletap",
    "options": [
      {
        "title": "epokenr",
        "values": [
          "412395"
        ]
      }
    ],
    "sales_channels": [
      {
        "id": defaultSalesChannel[0].id
      }
    ],
    "category_ids": [
      categoryResult.find((cat) => cat.name === "Reservedele")?.id
    ],
    "status": ProductStatus.PUBLISHED,
    "variants": [
      {
        "title": "kugletap",
        "sku": "412395",
        "prices": [
          {
            "amount": 79,
            "currency_code": "eur"
          },
          {
            "amount": 850,
            "currency_code": "dkk"
          }
        ],
        "manage_inventory": false,
        "hs_code": "2",
        "options": {
          "epokenr": "412395"
        }
      }
    ]
  },
  {
    "title": "arm",
    "options": [
      {
        "title": "epokenr",
        "values": [
          "422926"
        ]
      }
    ],
    "sales_channels": [
      {
        "id": defaultSalesChannel[0].id
      }
    ],
    "category_ids": [
      categoryResult.find((cat) => cat.name === "Reservedele")?.id
    ],
    "status": ProductStatus.PUBLISHED,
    "variants": [
      {
        "title": "arm",
        "sku": "422926",
        "prices": [
          {
            "amount": 79,
            "currency_code": "eur"
          },
          {
            "amount": 850,
            "currency_code": "dkk"
          }
        ],
        "manage_inventory": false,
        "hs_code": "1",
        "options": {
          "epokenr": "422926"
        }
      }
    ]
  },
  {
    "title": "reguleringsstang, L=115 mm",
    "options": [
      {
        "title": "epokenr",
        "values": [
          "424536"
        ]
      }
    ],
    "sales_channels": [
      {
        "id": defaultSalesChannel[0].id
      }
    ],
    "category_ids": [
      categoryResult.find((cat) => cat.name === "Reservedele")?.id
    ],
    "status": ProductStatus.PUBLISHED,
    "variants": [
      {
        "title": "reguleringsstang, L=115 mm",
        "sku": "424536",
        "prices": [
          {
            "amount": 79,
            "currency_code": "eur"
          },
          {
            "amount": 850,
            "currency_code": "dkk"
          }
        ],
        "manage_inventory": false,
        "hs_code": "1",
        "options": {
          "epokenr": "424536"
        }
      }
    ]
  },
  {
    "title": "reguleringsstang, L=265 mm",
    "options": [
      {
        "title": "epokenr",
        "values": [
          "424796"
        ]
      }
    ],
    "sales_channels": [
      {
        "id": defaultSalesChannel[0].id
      }
    ],
    "category_ids": [
      categoryResult.find((cat) => cat.name === "Reservedele")?.id
    ],
    "status": ProductStatus.PUBLISHED,
    "variants": [
      {
        "title": "reguleringsstang, L=265 mm",
        "sku": "424796",
        "prices": [
          {
            "amount": 79,
            "currency_code": "eur"
          },
          {
            "amount": 850,
            "currency_code": "dkk"
          }
        ],
        "manage_inventory": false,
        "hs_code": "1",
        "options": {
          "epokenr": "424796"
        }
      }
    ]
  },
  {
    "title": "reguleringsstang, L=175 mm",
    "options": [
      {
        "title": "epokenr",
        "values": [
          "500278"
        ]
      }
    ],
    "sales_channels": [
      {
        "id": defaultSalesChannel[0].id
      }
    ],
    "category_ids": [
      categoryResult.find((cat) => cat.name === "Reservedele")?.id
    ],
    "status": ProductStatus.PUBLISHED,
    "variants": [
      {
        "title": "reguleringsstang, L=175 mm",
        "sku": "500278",
        "prices": [
          {
            "amount": 79,
            "currency_code": "eur"
          },
          {
            "amount": 850,
            "currency_code": "dkk"
          }
        ],
        "manage_inventory": false,
        "hs_code": "1",
        "options": {
          "epokenr": "500278"
        }
      }
    ]
  },
  {
    "title": "reguleringsstang, L=155 mm",
    "options": [
      {
        "title": "epokenr",
        "values": [
          "512063"
        ]
      }
    ],
    "sales_channels": [
      {
        "id": defaultSalesChannel[0].id
      }
    ],
    "category_ids": [
      categoryResult.find((cat) => cat.name === "Reservedele")?.id
    ],
    "status": ProductStatus.PUBLISHED,
    "variants": [
      {
        "title": "reguleringsstang, L=155 mm",
        "sku": "512063",
        "prices": [
          {
            "amount": 79,
            "currency_code": "eur"
          },
          {
            "amount": 850,
            "currency_code": "dkk"
          }
        ],
        "manage_inventory": false,
        "hs_code": "1",
        "options": {
          "epokenr": "512063"
        }
      }
    ]
  },
  {
    "title": "servomotor",
    "options": [
      {
        "title": "epokenr",
        "values": [
          "437244"
        ]
      }
    ],
    "sales_channels": [
      {
        "id": defaultSalesChannel[0].id
      }
    ],
    "category_ids": [
      categoryResult.find((cat) => cat.name === "Reservedele")?.id
    ],
    "status": ProductStatus.PUBLISHED,
    "variants": [
      {
        "title": "servomotor",
        "sku": "437244",
        "prices": [
          {
            "amount": 79,
            "currency_code": "eur"
          },
          {
            "amount": 850,
            "currency_code": "dkk"
          }
        ],
        "manage_inventory": false,
        "hs_code": "1",
        "options": {
          "epokenr": "437244"
        }
      }
    ]
  },
  {
    "title": "sekskantskrue",
    "options": [
      {
        "title": "epokenr",
        "values": [
          "80252580"
        ]
      }
    ],
    "sales_channels": [
      {
        "id": defaultSalesChannel[0].id
      }
    ],
    "category_ids": [
      categoryResult.find((cat) => cat.name === "Reservedele")?.id
    ],
    "status": ProductStatus.PUBLISHED,
    "variants": [
      {
        "title": "sekskantskrue",
        "sku": "80252580",
        "prices": [
          {
            "amount": 79,
            "currency_code": "eur"
          },
          {
            "amount": 850,
            "currency_code": "dkk"
          }
        ],
        "manage_inventory": false,
        "hs_code": "2",
        "options": {
          "epokenr": "80252580"
        }
      }
    ]
  },
  {
    "title": "sekskantmøtrik",
    "options": [
      {
        "title": "epokenr",
        "values": [
          "80551760"
        ]
      }
    ],
    "sales_channels": [
      {
        "id": defaultSalesChannel[0].id
      }
    ],
    "category_ids": [
      categoryResult.find((cat) => cat.name === "Reservedele")?.id
    ],
    "status": ProductStatus.PUBLISHED,
    "variants": [
      {
        "title": "sekskantmøtrik",
        "sku": "80551760",
        "prices": [
          {
            "amount": 79,
            "currency_code": "eur"
          },
          {
            "amount": 850,
            "currency_code": "dkk"
          }
        ],
        "manage_inventory": false,
        "hs_code": "2",
        "options": {
          "epokenr": "80551760"
        }
      }
    ]
  },
  {
    "title": "skive",
    "options": [
      {
        "title": "epokenr",
        "values": [
          "80673107"
        ]
      }
    ],
    "sales_channels": [
      {
        "id": defaultSalesChannel[0].id
      }
    ],
    "category_ids": [
      categoryResult.find((cat) => cat.name === "Reservedele")?.id
    ],
    "status": ProductStatus.PUBLISHED,
    "variants": [
      {
        "title": "skive",
        "sku": "80673107",
        "prices": [
          {
            "amount": 79,
            "currency_code": "eur"
          },
          {
            "amount": 850,
            "currency_code": "dkk"
          }
        ],
        "manage_inventory": false,
        "hs_code": "4",
        "options": {
          "epokenr": "80673107"
        }
      }
    ]
  },
  {
    "title": "kuglesæde, plast",
    "options": [
      {
        "title": "epokenr",
        "values": [
          "84794495"
        ]
      }
    ],
    "sales_channels": [
      {
        "id": defaultSalesChannel[0].id
      }
    ],
    "category_ids": [
      categoryResult.find((cat) => cat.name === "Reservedele")?.id
    ],
    "status": ProductStatus.PUBLISHED,
    "variants": [
      {
        "title": "kuglesæde, plast",
        "sku": "84794495",
        "prices": [
          {
            "amount": 79,
            "currency_code": "eur"
          },
          {
            "amount": 850,
            "currency_code": "dkk"
          }
        ],
        "manage_inventory": false,
        "hs_code": "1",
        "options": {
          "epokenr": "84794495"
        }
      }
    ]
  },
  {
    "title": "CEE stik",
    "options": [
      {
        "title": "epokenr",
        "values": [
          "83055786"
        ]
      }
    ],
    "sales_channels": [
      {
        "id": defaultSalesChannel[0].id
      }
    ],
    "category_ids": [
      categoryResult.find((cat) => cat.name === "Reservedele")?.id
    ],
    "status": ProductStatus.PUBLISHED,
    "variants": [
      {
        "title": "CEE stik",
        "sku": "83055786",
        "prices": [
          {
            "amount": 79,
            "currency_code": "eur"
          },
          {
            "amount": 850,
            "currency_code": "dkk"
          }
        ],
        "manage_inventory": false,
        "hs_code": "1",
        "options": {
          "epokenr": "83055786"
        }
      }
    ]
  },
  {
    "title": "mont.kasse, tom",
    "options": [
      {
        "title": "epokenr",
        "values": [
          "83115785"
        ]
      }
    ],
    "sales_channels": [
      {
        "id": defaultSalesChannel[0].id
      }
    ],
    "category_ids": [
      categoryResult.find((cat) => cat.name === "Reservedele")?.id
    ],
    "status": ProductStatus.PUBLISHED,
    "variants": [
      {
        "title": "mont.kasse, tom",
        "sku": "83115785",
        "prices": [
          {
            "amount": 79,
            "currency_code": "eur"
          },
          {
            "amount": 850,
            "currency_code": "dkk"
          }
        ],
        "manage_inventory": false,
        "hs_code": "1",
        "options": {
          "epokenr": "83115785"
        }
      }
    ]
  },
  {
    "title": "hjælpekontakt start",
    "options": [
      {
        "title": "epokenr",
        "values": [
          "83005783"
        ]
      }
    ],
    "sales_channels": [
      {
        "id": defaultSalesChannel[0].id
      }
    ],
    "category_ids": [
      categoryResult.find((cat) => cat.name === "Reservedele")?.id
    ],
    "status": ProductStatus.PUBLISHED,
    "variants": [
      {
        "title": "hjælpekontakt start",
        "sku": "83005783",
        "prices": [
          {
            "amount": 79,
            "currency_code": "eur"
          },
          {
            "amount": 850,
            "currency_code": "dkk"
          }
        ],
        "manage_inventory": false,
        "hs_code": "1",
        "options": {
          "epokenr": "83005783"
        }
      }
    ]
  },
  {
    "title": "kontrol station",
    "options": [
      {
        "title": "epokenr",
        "values": [
          "83118980"
        ]
      }
    ],
    "sales_channels": [
      {
        "id": defaultSalesChannel[0].id
      }
    ],
    "category_ids": [
      categoryResult.find((cat) => cat.name === "Reservedele")?.id
    ],
    "status": ProductStatus.PUBLISHED,
    "variants": [
      {
        "title": "kontrol station",
        "sku": "83118980",
        "prices": [
          {
            "amount": 79,
            "currency_code": "eur"
          },
          {
            "amount": 850,
            "currency_code": "dkk"
          }
        ],
        "manage_inventory": false,
        "hs_code": "1",
        "options": {
          "epokenr": "83118980"
        }
      }
    ]
  },
  {
    "title": "termoudløser, 8-12A",
    "options": [
      {
        "title": "epokenr",
        "values": [
          "83135784"
        ]
      }
    ],
    "sales_channels": [
      {
        "id": defaultSalesChannel[0].id
      }
    ],
    "category_ids": [
      categoryResult.find((cat) => cat.name === "Reservedele")?.id
    ],
    "status": ProductStatus.PUBLISHED,
    "variants": [
      {
        "title": "termoudløser, 8-12A",
        "sku": "83135784",
        "prices": [
          {
            "amount": 79,
            "currency_code": "eur"
          },
          {
            "amount": 850,
            "currency_code": "dkk"
          }
        ],
        "manage_inventory": false,
        "hs_code": "1",
        "options": {
          "epokenr": "83135784"
        }
      }
    ]
  },
  {
    "title": "termoudløser, 11-16A",
    "options": [
      {
        "title": "epokenr",
        "values": [
          "83138046"
        ]
      }
    ],
    "sales_channels": [
      {
        "id": defaultSalesChannel[0].id
      }
    ],
    "category_ids": [
      categoryResult.find((cat) => cat.name === "Reservedele")?.id
    ],
    "status": ProductStatus.PUBLISHED,
    "variants": [
      {
        "title": "termoudløser, 11-16A",
        "sku": "83138046",
        "prices": [
          {
            "amount": 79,
            "currency_code": "eur"
          },
          {
            "amount": 850,
            "currency_code": "dkk"
          }
        ],
        "manage_inventory": false,
        "hs_code": "1",
        "options": {
          "epokenr": "83138046"
        }
      }
    ]
  },
  {
    "title": "elektrisk motor",
    "options": [
      {
        "title": "epokenr",
        "values": [
          "83025023"
        ]
      }
    ],
    "sales_channels": [
      {
        "id": defaultSalesChannel[0].id
      }
    ],
    "category_ids": [
      categoryResult.find((cat) => cat.name === "Reservedele")?.id
    ],
    "status": ProductStatus.PUBLISHED,
    "variants": [
      {
        "title": "elektrisk motor",
        "sku": "83025023",
        "prices": [
          {
            "amount": 79,
            "currency_code": "eur"
          },
          {
            "amount": 850,
            "currency_code": "dkk"
          }
        ],
        "manage_inventory": false,
        "hs_code": "1",
        "options": {
          "epokenr": "83025023"
        }
      }
    ]
  },
  {
    "title": "kontaktor, 400 V",
    "options": [
      {
        "title": "epokenr",
        "values": [
          "83135782"
        ]
      }
    ],
    "sales_channels": [
      {
        "id": defaultSalesChannel[0].id
      }
    ],
    "category_ids": [
      categoryResult.find((cat) => cat.name === "Reservedele")?.id
    ],
    "status": ProductStatus.PUBLISHED,
    "variants": [
      {
        "title": "kontaktor, 400 V",
        "sku": "83135782",
        "prices": [
          {
            "amount": 79,
            "currency_code": "eur"
          },
          {
            "amount": 850,
            "currency_code": "dkk"
          }
        ],
        "manage_inventory": false,
        "hs_code": "1",
        "options": {
          "epokenr": "83135782"
        }
      }
    ]
  },
  {
    "title": "kontaktor, 230 V",
    "options": [
      {
        "title": "epokenr",
        "values": [
          "83138262"
        ]
      }
    ],
    "sales_channels": [
      {
        "id": defaultSalesChannel[0].id
      }
    ],
    "category_ids": [
      categoryResult.find((cat) => cat.name === "Reservedele")?.id
    ],
    "status": ProductStatus.PUBLISHED,
    "variants": [
      {
        "title": "kontaktor, 230 V",
        "sku": "83138262",
        "prices": [
          {
            "amount": 79,
            "currency_code": "eur"
          },
          {
            "amount": 850,
            "currency_code": "dkk"
          }
        ],
        "manage_inventory": false,
        "hs_code": "1",
        "options": {
          "epokenr": "83138262"
        }
      }
    ]
  },
  {
    "title": "batterikabelsæt",
    "options": [
      {
        "title": "epokenr",
        "values": [
          "439065"
        ]
      }
    ],
    "sales_channels": [
      {
        "id": defaultSalesChannel[0].id
      }
    ],
    "category_ids": [
      categoryResult.find((cat) => cat.name === "Reservedele")?.id
    ],
    "status": ProductStatus.PUBLISHED,
    "variants": [
      {
        "title": "batterikabelsæt",
        "sku": "439065",
        "prices": [
          {
            "amount": 79,
            "currency_code": "eur"
          },
          {
            "amount": 850,
            "currency_code": "dkk"
          }
        ],
        "manage_inventory": false,
        "hs_code": "1",
        "options": {
          "epokenr": "439065"
        }
      }
    ]
  },
  {
    "title": "startbox kpl.",
    "options": [
      {
        "title": "epokenr",
        "values": [
          "439392"
        ]
      }
    ],
    "sales_channels": [
      {
        "id": defaultSalesChannel[0].id
      }
    ],
    "category_ids": [
      categoryResult.find((cat) => cat.name === "Reservedele")?.id
    ],
    "status": ProductStatus.PUBLISHED,
    "variants": [
      {
        "title": "startbox kpl.",
        "sku": "439392",
        "prices": [
          {
            "amount": 79,
            "currency_code": "eur"
          },
          {
            "amount": 850,
            "currency_code": "dkk"
          }
        ],
        "manage_inventory": false,
        "hs_code": "1",
        "options": {
          "epokenr": "439392"
        }
      }
    ]
  },
  {
    "title": "powerbox kpl.",
    "options": [
      {
        "title": "epokenr",
        "values": [
          "439393"
        ]
      }
    ],
    "sales_channels": [
      {
        "id": defaultSalesChannel[0].id
      }
    ],
    "category_ids": [
      categoryResult.find((cat) => cat.name === "Reservedele")?.id
    ],
    "status": ProductStatus.PUBLISHED,
    "variants": [
      {
        "title": "powerbox kpl.",
        "sku": "439393",
        "prices": [
          {
            "amount": 79,
            "currency_code": "eur"
          },
          {
            "amount": 850,
            "currency_code": "dkk"
          }
        ],
        "manage_inventory": false,
        "hs_code": "1",
        "options": {
          "epokenr": "439393"
        }
      }
    ]
  },
  {
    "title": "forlænger kabel 10 pol",
    "options": [
      {
        "title": "epokenr",
        "values": [
          "439394"
        ]
      }
    ],
    "sales_channels": [
      {
        "id": defaultSalesChannel[0].id
      }
    ],
    "category_ids": [
      categoryResult.find((cat) => cat.name === "Reservedele")?.id
    ],
    "status": ProductStatus.PUBLISHED,
    "variants": [
      {
        "title": "forlænger kabel 10 pol",
        "sku": "439394",
        "prices": [
          {
            "amount": 79,
            "currency_code": "eur"
          },
          {
            "amount": 850,
            "currency_code": "dkk"
          }
        ],
        "manage_inventory": false,
        "hs_code": "1",
        "options": {
          "epokenr": "439394"
        }
      }
    ]
  },
  {
    "title": "nøgleomskifter",
    "options": [
      {
        "title": "epokenr",
        "values": [
          "83001134"
        ]
      }
    ],
    "sales_channels": [
      {
        "id": defaultSalesChannel[0].id
      }
    ],
    "category_ids": [
      categoryResult.find((cat) => cat.name === "Reservedele")?.id
    ],
    "status": ProductStatus.PUBLISHED,
    "variants": [
      {
        "title": "nøgleomskifter",
        "sku": "83001134",
        "prices": [
          {
            "amount": 79,
            "currency_code": "eur"
          },
          {
            "amount": 850,
            "currency_code": "dkk"
          }
        ],
        "manage_inventory": false,
        "hs_code": "1",
        "options": {
          "epokenr": "83001134"
        }
      }
    ]
  },
  {
    "title": "batteriafbryder",
    "options": [
      {
        "title": "epokenr",
        "values": [
          "83009702"
        ]
      }
    ],
    "sales_channels": [
      {
        "id": defaultSalesChannel[0].id
      }
    ],
    "category_ids": [
      categoryResult.find((cat) => cat.name === "Reservedele")?.id
    ],
    "status": ProductStatus.PUBLISHED,
    "variants": [
      {
        "title": "batteriafbryder",
        "sku": "83009702",
        "prices": [
          {
            "amount": 79,
            "currency_code": "eur"
          },
          {
            "amount": 850,
            "currency_code": "dkk"
          }
        ],
        "manage_inventory": false,
        "hs_code": "1",
        "options": {
          "epokenr": "83009702"
        }
      }
    ]
  },
  {
    "title": "startbatteri",
    "options": [
      {
        "title": "epokenr",
        "values": [
          "83022536"
        ]
      }
    ],
    "sales_channels": [
      {
        "id": defaultSalesChannel[0].id
      }
    ],
    "category_ids": [
      categoryResult.find((cat) => cat.name === "Reservedele")?.id
    ],
    "status": ProductStatus.PUBLISHED,
    "variants": [
      {
        "title": "startbatteri",
        "sku": "83022536",
        "prices": [
          {
            "amount": 79,
            "currency_code": "eur"
          },
          {
            "amount": 850,
            "currency_code": "dkk"
          }
        ],
        "manage_inventory": false,
        "hs_code": "1",
        "options": {
          "epokenr": "83022536"
        }
      }
    ]
  },
  {
    "title": "gummihætte",
    "options": [
      {
        "title": "epokenr",
        "values": [
          "83078818"
        ]
      }
    ],
    "sales_channels": [
      {
        "id": defaultSalesChannel[0].id
      }
    ],
    "category_ids": [
      categoryResult.find((cat) => cat.name === "Reservedele")?.id
    ],
    "status": ProductStatus.PUBLISHED,
    "variants": [
      {
        "title": "gummihætte",
        "sku": "83078818",
        "prices": [
          {
            "amount": 79,
            "currency_code": "eur"
          },
          {
            "amount": 850,
            "currency_code": "dkk"
          }
        ],
        "manage_inventory": false,
        "hs_code": "1",
        "options": {
          "epokenr": "83078818"
        }
      }
    ]
  },
  {
    "title": "kabelsko",
    "options": [
      {
        "title": "epokenr",
        "values": [
          "83092142"
        ]
      }
    ],
    "sales_channels": [
      {
        "id": defaultSalesChannel[0].id
      }
    ],
    "category_ids": [
      categoryResult.find((cat) => cat.name === "Reservedele")?.id
    ],
    "status": ProductStatus.PUBLISHED,
    "variants": [
      {
        "title": "kabelsko",
        "sku": "83092142",
        "prices": [
          {
            "amount": 79,
            "currency_code": "eur"
          },
          {
            "amount": 850,
            "currency_code": "dkk"
          }
        ],
        "manage_inventory": false,
        "hs_code": "1",
        "options": {
          "epokenr": "83092142"
        }
      }
    ]
  },
  {
    "title": "kabelsko minus sko",
    "options": [
      {
        "title": "epokenr",
        "values": [
          "83092583"
        ]
      }
    ],
    "sales_channels": [
      {
        "id": defaultSalesChannel[0].id
      }
    ],
    "category_ids": [
      categoryResult.find((cat) => cat.name === "Reservedele")?.id
    ],
    "status": ProductStatus.PUBLISHED,
    "variants": [
      {
        "title": "kabelsko minus sko",
        "sku": "83092583",
        "prices": [
          {
            "amount": 79,
            "currency_code": "eur"
          },
          {
            "amount": 850,
            "currency_code": "dkk"
          }
        ],
        "manage_inventory": false,
        "hs_code": "1",
        "options": {
          "epokenr": "83092583"
        }
      }
    ]
  },
  {
    "title": "relæ",
    "options": [
      {
        "title": "epokenr",
        "values": [
          "83139063"
        ]
      }
    ],
    "sales_channels": [
      {
        "id": defaultSalesChannel[0].id
      }
    ],
    "category_ids": [
      categoryResult.find((cat) => cat.name === "Reservedele")?.id
    ],
    "status": ProductStatus.PUBLISHED,
    "variants": [
      {
        "title": "relæ",
        "sku": "83139063",
        "prices": [
          {
            "amount": 79,
            "currency_code": "eur"
          },
          {
            "amount": 850,
            "currency_code": "dkk"
          }
        ],
        "manage_inventory": false,
        "hs_code": "1",
        "options": {
          "epokenr": "83139063"
        }
      }
    ]
  },
  {
    "title": "fladsikring",
    "options": [
      {
        "title": "epokenr",
        "values": [
          "83149079"
        ]
      }
    ],
    "sales_channels": [
      {
        "id": defaultSalesChannel[0].id
      }
    ],
    "category_ids": [
      categoryResult.find((cat) => cat.name === "Reservedele")?.id
    ],
    "status": ProductStatus.PUBLISHED,
    "variants": [
      {
        "title": "fladsikring",
        "sku": "83149079",
        "prices": [
          {
            "amount": 79,
            "currency_code": "eur"
          },
          {
            "amount": 850,
            "currency_code": "dkk"
          }
        ],
        "manage_inventory": false,
        "hs_code": "1",
        "options": {
          "epokenr": "83149079"
        }
      }
    ]
  },
  {
    "title": "forlængerkabel, L=8,0m",
    "options": [
      {
        "title": "epokenr",
        "values": [
          "439831"
        ]
      }
    ],
    "sales_channels": [
      {
        "id": defaultSalesChannel[0].id
      }
    ],
    "category_ids": [
      categoryResult.find((cat) => cat.name === "Reservedele")?.id
    ],
    "status": ProductStatus.PUBLISHED,
    "variants": [
      {
        "title": "forlængerkabel, L=8,0m",
        "sku": "439831",
        "prices": [
          {
            "amount": 79,
            "currency_code": "eur"
          },
          {
            "amount": 850,
            "currency_code": "dkk"
          }
        ],
        "manage_inventory": false,
        "hs_code": "1",
        "options": {
          "epokenr": "439831"
        }
      }
    ]
  },
  {
    "title": "forlængerkabel, L=3,0m",
    "options": [
      {
        "title": "epokenr",
        "values": [
          "439832"
        ]
      }
    ],
    "sales_channels": [
      {
        "id": defaultSalesChannel[0].id
      }
    ],
    "category_ids": [
      categoryResult.find((cat) => cat.name === "Reservedele")?.id
    ],
    "status": ProductStatus.PUBLISHED,
    "variants": [
      {
        "title": "forlængerkabel, L=3,0m",
        "sku": "439832",
        "prices": [
          {
            "amount": 79,
            "currency_code": "eur"
          },
          {
            "amount": 850,
            "currency_code": "dkk"
          }
        ],
        "manage_inventory": false,
        "hs_code": "1",
        "options": {
          "epokenr": "439832"
        }
      }
    ]
  },
  {
    "title": "batterikabelset",
    "options": [
      {
        "title": "epokenr",
        "values": [
          "439833"
        ]
      }
    ],
    "sales_channels": [
      {
        "id": defaultSalesChannel[0].id
      }
    ],
    "category_ids": [
      categoryResult.find((cat) => cat.name === "Reservedele")?.id
    ],
    "status": ProductStatus.PUBLISHED,
    "variants": [
      {
        "title": "batterikabelset",
        "sku": "439833",
        "prices": [
          {
            "amount": 79,
            "currency_code": "eur"
          },
          {
            "amount": 850,
            "currency_code": "dkk"
          }
        ],
        "manage_inventory": false,
        "hs_code": "1",
        "options": {
          "epokenr": "439833"
        }
      }
    ]
  },
  {
    "title": "print, Hatz startbox",
    "options": [
      {
        "title": "epokenr",
        "values": [
          "438281"
        ]
      }
    ],
    "sales_channels": [
      {
        "id": defaultSalesChannel[0].id
      }
    ],
    "category_ids": [
      categoryResult.find((cat) => cat.name === "Reservedele")?.id
    ],
    "status": ProductStatus.PUBLISHED,
    "variants": [
      {
        "title": "print, Hatz startbox",
        "sku": "438281",
        "prices": [
          {
            "amount": 79,
            "currency_code": "eur"
          },
          {
            "amount": 850,
            "currency_code": "dkk"
          }
        ],
        "manage_inventory": false,
        "hs_code": "1",
        "options": {
          "epokenr": "438281"
        }
      }
    ]
  },
  {
    "title": "powerbox",
    "options": [
      {
        "title": "epokenr",
        "values": [
          "439048"
        ]
      }
    ],
    "sales_channels": [
      {
        "id": defaultSalesChannel[0].id
      }
    ],
    "category_ids": [
      categoryResult.find((cat) => cat.name === "Reservedele")?.id
    ],
    "status": ProductStatus.PUBLISHED,
    "variants": [
      {
        "title": "powerbox",
        "sku": "439048",
        "prices": [
          {
            "amount": 79,
            "currency_code": "eur"
          },
          {
            "amount": 850,
            "currency_code": "dkk"
          }
        ],
        "manage_inventory": false,
        "hs_code": "1",
        "options": {
          "epokenr": "439048"
        }
      }
    ]
  },
  {
    "title": "kasse, tom",
    "options": [
      {
        "title": "epokenr",
        "values": [
          "437242"
        ]
      }
    ],
    "sales_channels": [
      {
        "id": defaultSalesChannel[0].id
      }
    ],
    "category_ids": [
      categoryResult.find((cat) => cat.name === "Reservedele")?.id
    ],
    "status": ProductStatus.PUBLISHED,
    "variants": [
      {
        "title": "kasse, tom",
        "sku": "437242",
        "prices": [
          {
            "amount": 79,
            "currency_code": "eur"
          },
          {
            "amount": 850,
            "currency_code": "dkk"
          }
        ],
        "manage_inventory": false,
        "hs_code": "1",
        "options": {
          "epokenr": "437242"
        }
      }
    ]
  },
  {
    "title": "styrebox kpl.",
    "options": [
      {
        "title": "epokenr",
        "values": [
          "437243"
        ]
      }
    ],
    "sales_channels": [
      {
        "id": defaultSalesChannel[0].id
      }
    ],
    "category_ids": [
      categoryResult.find((cat) => cat.name === "Reservedele")?.id
    ],
    "status": ProductStatus.PUBLISHED,
    "variants": [
      {
        "title": "styrebox kpl.",
        "sku": "437243",
        "prices": [
          {
            "amount": 79,
            "currency_code": "eur"
          },
          {
            "amount": 850,
            "currency_code": "dkk"
          }
        ],
        "manage_inventory": false,
        "hs_code": "1",
        "options": {
          "epokenr": "437243"
        }
      }
    ]
  },
],
    },
  });

  logger.info("Finished seeding product data.");
}
