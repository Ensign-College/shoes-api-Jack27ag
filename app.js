require("dotenv").config();
const { createClient } = require("redis");
const express = require("express");
const cors = require("cors");
const e = require("express");

const redisClient = createClient({
  host: process.env.REDIS_HOST,
  port: process.env.REDIS_PORT,
});

redisClient.on("error", (err) => {
  console.log("Redis Client error", err);
});
redisClient.connect();

const app = express();
app.use(express.json());

const corsOptions = {
  origin: process.env.FRONTEND_ORIGIN,
};
app.use(cors(corsOptions));

app.get("/", (req, res) => {
  res.send("Hello World!");
});

// POST /Collections
app.post("/watch_collections", async (req, res) => {
  const key = "Collections";
  const data = {};

  try {
    const collections = await redisClient.get(key);
    if (!collections) {
      await redisClient.set(key, JSON.stringify(data));
      res.status(201).send({ message: "Collections saved successfully!" });
    } else {
      res.status(200).send({ message: "Collections already exist!" });
    }
  } catch (error) {
    console.error(error);
    res.status(500).send({ message: "Error saving Collections!" });
  }
});

// GET /Collections
app.get("/watch_collections", async (req, res) => {
  try {
    const Collections = await redisClient.get("Collections");
    if (Collections === null) {
      res.status(404).send({ message: "Collections not found!" });
    } else {
      res.status(200).send({ Collections: JSON.parse(Collections) });
    }
  } catch (error) {
    console.error(error);
    res.status(500).send({ message: "Error retrieving data!" });
  }
});

// POST /collection
app.post("/watch_collections/collection", async (req, res) => {
  const { owner } = req.body;
  let Collections = {};
  try {
    const collections = await redisClient.get("Collections");
    if (collections) {
      Collections = JSON.parse(collections);
    }
    if (!(await redisClient.get("collectionID_counter"))) {
      await redisClient.set("collectionID_counter", 0);
    }
    const newCollectionID = await redisClient.incr("collectionID_counter");
    const CollectionKey = `collectionID_${newCollectionID}`;
    Collections[CollectionKey] = {
      owner: owner,
      watches: [],
    };
    await redisClient.set("Collections", JSON.stringify(Collections));
    res.status(201).send({ message: "Collection created successfully!" });
  } catch (error) {
    console.error(error);
    res.status(500).send({ message: "Error creating collection!" });
  }
});

// GET /collection
app.get("/watch_collections/collection/:collectionID", async (req, res) => {
  const { collectionID } = req.params;
  const key = "Collections";
  try {
    const Collections = await redisClient.get(key);
    if (Collections === null) {
      res.status(404).send({ message: "Collections not found!" });
      return;
    }
    const collection = JSON.parse(Collections)[`collectionID_${collectionID}`];
    if (collection === null) {
      res.status(404).send({ message: "Collection not found!" });
    } else {
      res.status(200).send({ collection });
    }
  } catch (error) {
    console.error(error);
    res.status(500).send({ message: "Error retrieving data!" });
  }
});

// PATCH /Collection - Updates owner
app.patch("/watch_collections/collection/:collectionID", async (req, res) => {
  const { collectionID } = req.params;
  const { owner } = req.body;
  const key = "Collections";
  try {
    let Collections = await redisClient.get(key);
    if (Collections === null) {
      res.status(404).send({ message: "Collections not found!" });
      return;
    }
    Collections = JSON.parse(Collections);
    const collection = Collections[`collectionID_${collectionID}`];
    if (collection === null) {
      res.status(404).send({ message: "Collection not found!" });
      return;
    }
    collection.owner = owner;
    await redisClient.set(key, JSON.stringify(Collections));
    res.status(200).send({ message: "Collection updated successfully!" });
  } catch (error) {
    console.error(error);
    res.status(500).send({ message: "Error updating collection!" });
  }
});

// Delete a collection
app.delete("/watch_collections/collection/:collectionID", async (req, res) => {
  const { collectionID } = req.params;
  const key = "Collections";
  try {
    let Collections = await redisClient.get(key);
    if (Collections === null) {
      res.status(404).send({ message: "Collections not found!" });
      return;
    }
    Collections = JSON.parse(Collections);
    if (!Collections[`collectionID_${collectionID}`]) {
      res.status(404).send({ message: "Collection not found!" });
      return;
    }
    delete Collections[`collectionID_${collectionID}`];
    await redisClient.set(key, JSON.stringify(Collections));
    res.status(200).send({ message: "Collection deleted successfully!" });
  } catch (error) {
    console.error(error);
    res.status(500).send({ message: "Error deleting collection!" });
  }
});

// POST /watch
app.post(
  "/watch_collections/collection/:collectionID/watch",
  async (req, res) => {
    const { collectionID } = req.params;
    const {
      refNumber,
      brand,
      model,
      movement,
      description,
      msrp,
      appraisal,
      acquisitionDate,
      color,
    } = req.body;
    const key = "Collections";
    try {
      let Collections = await redisClient.get(key);
      if (Collections === null) {
        res.status(404).send({ message: "Collections not found!" });
        return;
      }
      Collections = JSON.parse(Collections);
      const collection = Collections[`collectionID_${collectionID}`];
      if (collection === null) {
        res.status(404).send({ message: "Collection not found!" });
        return;
      }
      if (!collection.watches) {
        collection.watches = [];
      }
      const watchID = await redisClient.incr("watchID_counter");
      const newWatch = {
        watchID,
        refNumber,
        brand,
        model,
        movement,
        description,
        msrp,
        appraisal,
        acquisitionDate,
        color,
      };
      collection.watches.push(newWatch);
      await redisClient.set(key, JSON.stringify(Collections));
      res.status(201).send({ message: "Watch added successfully!" });
    } catch (error) {
      console.error(error);
      res.status(500).send({ message: "Error adding watch!" });
    }
  }
);

// GET /watch
app.get(
  "/watch_collections/collection/:collectionID/watch/:watchID",
  async (req, res) => {
    const { collectionID, watchID } = req.params;
    const key = "Collections";
    try {
      let Collections = await redisClient.get(key);
      if (!Collections) {
        res.status(404).send({ message: "Collections not found!" });
        return;
      }
      Collections = JSON.parse(Collections);
      const collection = Collections[`collectionID_${collectionID}`];
      if (!collection) {
        res.status(404).send({ message: "Collection not found!" });
      }
      if (!collection.watches) {
        res.status(404).send({ message: "Watches not found!" });
      }
      const watch = collection.watches.find(
        (w) => w.watchID === parseInt(watchID)
      );
      if (!watch) {
        res.status(404).send({ message: "Watch not found!" });
      } else {
        res.status(200).send(watch);
      }
    } catch (error) {
      console.error(error);
      res.status(500).send({ message: "Error retrieving data!" });
    }
  }
);

// PATCH /watch - Updates watch details
app.patch(
  "/watch_collections/collection/:collectionID/watch/:watchID",
  async (req, res) => {
    const { collectionID, watchID } = req.params;
    const updateWatch = req.body;
    const key = "Collections";
    try {
      let Collections = await redisClient.get(key);
      if (!Collections) {
        res.status(404).send({ message: "Collections not found!" });
        return;
      }
      Collections = JSON.parse(Collections);
      const collection = Collections[`collectionID_${collectionID}`];
      if (!collection) {
        res.status(404).send({ message: "Collection not found!" });
      }
      if (!collection.watches) {
        res.status(404).send({ message: "Watches not found!" });
      }
      const watch = collection.watches.find(
        (w) => w.watchID === parseInt(watchID)
      );
      if (!watch) {
        res.status(404).send({ message: "Watch not found!" });
      }
      Object.keys(updateWatch).map((key) => {
        if (watch.hasOwnProperty(key)) {
          watch[key] = updateWatch[key];
        } else {
          res.status(404).send({ message: `Watch does not have ${key}!` });
        }
      });
      await redisClient.set(key, JSON.stringify(Collections));
      res.status(200).send({ message: "Watch updated successfully!" });
    } catch (error) {
      console.error(error);
      res.status(500).send({ message: "Error updating watch!" });
    }
  }
);

// DELETE /watch
app.delete(
  "/watch_collections/collection/:collectionID/watch/:watchID",
  async (req, res) => {
    const { collectionID, watchID } = req.params;
    const key = "Collections";
    try {
      let Collections = await redisClient.get(key);
      if (!Collections) {
        res.status(404).send({ message: "Collections not found!" });
        return;
      }
      Collections = JSON.parse(Collections);
      let collection = Collections[`collectionID_${collectionID}`];
      if (!collection) {
        res.status(404).send({ message: "Collection not found!" });
      }
      if (!collection.watches) {
        res.status(404).send({ message: "Watches not found!" });
      }
      const watchIndex = collection.watches.findIndex(
        (w) => w.watchID === parseInt(watchID)
      );
      if (watchIndex === -1) {
        res.status(404).send({ message: "Watch not found!" });
        return;
      }
      collection.watches.splice(watchIndex, 1);
      await redisClient.set(key, JSON.stringify(Collections));
      res.status(200).send({ message: "Watch deleted successfully!" });
    } catch (error) {
      console.error(error);
      res.status(500).send({ message: "Error deliting watch!" });
    }
  }
);

// POST / Create providers
app.post("/watch_providers", async (req, res) => {
  const key = "Providers";
  const data = {};

  try {
    const providers = await redisClient.get(key);
    if (!providers) {
      await redisClient.set(key, JSON.stringify(data));
      res.status(201).send({ message: "Providers saved successfully!" });
    }
  } catch (error) {
    console.error(error);
    res.status(500).send({ message: "Error saving Providers!" });
  }
});

// GET /providers
app.get("/watch_providers", async (req, res) => {
  try {
    const Providers = await redisClient.get("Providers");
    if (!Providers) {
      res.status(404).send({ message: "Providers not found!" });
    } else {
      res.status(200).send({ Providers: JSON.parse(Providers) });
    }
  } catch (error) {
    console.error(error);
    res.status(500).send({ message: "Error retrieving data!" });
  }
});

// POST /provider
app.post("/watch_providers/provider", async (req, res) => {
  const { brand, website, countryOrigin } = req.body;
  let Providers = [];
  try {
    const providers = await redisClient.get("Providers");
    if (providers) {
      Providers = JSON.parse(providers);
    }
    if (!(await redisClient.get("provider_counter"))) {
      await redisClient.set("provider_counter", 0);
    }
    const newProviderID = await redisClient.incr("provider_counter");
    const providerKey = `provider_${newProviderID}`;
    Providers[providerKey] = {
      brand,
      website,
      countryOrigin,
      stockWatches: [],
    };
    await redisClient.set("Providers", JSON.stringify(Providers));
    res.status(201).send({ message: "Provider created successfully!" });
  } catch (error) {
    console.error(error);
    res.status(500).send({ message: "Error creating collection!" });
  }
});

// GET /provider
app.get("/watch_providers/provider/:providerID", async (req, res) => {
  const { providerID } = req.params;
  try {
    const Providers = await redisClient.get("Providers");
    if (!Providers) {
      res.status(404).send({ message: "Providers not found!" });
      return;
    }
    const provider = JSON.parse(Providers)[`provider_${providerID}`];
    if (!provider) {
      res.status(404).send({ message: "Provider not found!" });
    } else {
      res.status(200).send({ provider });
    }
  } catch (error) {
    console.error(error);
    res.status(500).send({ message: "Error retrieving data!" });
  }
});

// PATCH /provider - Updates provider details
app.patch("/watch_providers/provider/:providerID", async (req, res) => {
  const { providerID } = req.params;
  const updateProvider = req.body;
  try {
    let Providers = await redisClient.get("Providers");
    if (!Providers) {
      res.status(404).send({ message: "Providers not found!" });
      return;
    }
    Providers = JSON.parse(Providers);
    const provider = Providers[`provider_${providerID}`];
    if (!provider) {
      res.status(404).send({ message: "Provider not found!" });
      return;
    }
    Object.keys(updateProvider).map((key) => {
      if (provider.hasOwnProperty(key)) {
        provider[key] = updateProvider[key];
      } else {
        res.status(404).send({ message: `Provider does not have ${key}!` });
      }
    });
    await redisClient.set("Providers", JSON.stringify(Providers));
    res.status(200).send({ message: "Provider updated successfully!" });
  } catch (error) {
    console.error(error);
    res.status(500).send({ message: "Error updating provider!" });
  }
});

// Delete /provider
app.delete("/watch_providers/provider/:providerID", async (req, res) => {
  const { providerID } = req.params;
  try {
    let Providers = await redisClient.get("Providers");
    if (!Providers) {
      res.status(404).send({ message: "Providers not found!" });
      return;
    }
    Providers = JSON.parse(Providers);
    if (!Providers[`provider_${providerID}`]) {
      res.status(404).send({ message: "Provider not found!" });
      return;
    }
    delete Providers[`provider_${providerID}`];
    await redisClient.set("Providers", JSON.stringify(Providers));
    res.status(200).send({ message: "Provider deleted successfully!" });
  } catch (error) {
    console.error(error);
    res.status(500).send({ message: "Error deleting provider!" });
  }
});

// POST / Add stock watch to provider
app.post(
  "/watch_providers/provider/:providerID/stock_watch",
  async (req, res) => {
    const { providerID } = req.params;
    const {
      refNumber,
      brand,
      model,
      movement,
      description,
      msrp,
      appraisal,
      acquisitionDate,
      color,
    } = req.body;
    const key = "Providers";
    try {
      let Providers = await redisClient.get(key);
      if (!Providers) {
        res.status(404).send({ message: "Providers not found!" });
        return;
      }
      Providers = JSON.parse(Providers);
      const provider = Providers[`provider_${providerID}`];
      if (!provider) {
        res.status(404).send({ message: "Provider not found!" });
        return;
      }
      if (!provider.stockWatches) {
        provider.stockWatches = [];
      }
      const watchID = await redisClient.incr("watchID_counter");
      const newWatch = {
        watchID,
        refNumber,
        brand,
        model,
        movement,
        description,
        msrp,
        appraisal,
        acquisitionDate,
        color,
      };
      provider.stockWatches.push(newWatch);
      await redisClient.set(key, JSON.stringify(Providers));
      res.status(201).send({ message: "Stock watch added successfully!" });
    } catch (error) {
      console.error(error);
      res.status(500).send({ message: "Error adding stock watch!" });
    }
  }
);

// GET / Get stock watch details
app.get(
  "/watch_providers/provider/:providerID/stock_watch/:watchID",
  async (req, res) => {
    const { providerID, watchID } = req.params;
    const key = "Providers";
    try {
      let Providers = await redisClient.get(key);
      if (!Providers) {
        res.status(404).send({ message: "Providers not found!" });
        return;
      }
      Providers = JSON.parse(Providers);
      const provider = Providers[`provider_${providerID}`];
      if (!provider) {
        res.status(404).send({ message: "Provider not found!" });
      }
      if (!provider.stockWatches) {
        res.status(404).send({ message: "Stock watches not found!" });
      }
      const watch = provider.stockWatches.find(
        (w) => w.watchID === parseInt(watchID)
      );
      if (!watch) {
        res.status(404).send({ message: "Stock watch not found!" });
      } else {
        res.status(200).send(watch);
      }
    } catch (error) {
      console.error(error);
      res.status(500).send({ message: "Error retrieving data!" });
    }
  }
);

// PATCH / Update stock watch details
app.patch(
  "/watch_providers/provider/:providerID/stock_watch/:watchID",
  async (req, res) => {
    const { providerID, watchID } = req.params;
    const updateWatch = req.body;
    const key = "Providers";
    try {
      let Providers = await redisClient.get(key);
      if (!Providers) {
        res.status(404).send({ message: "Providers not found!" });
        return;
      }
      Providers = JSON.parse(Providers);
      const provider = Providers[`provider_${providerID}`];
      if (!provider) {
        res.status(404).send({ message: "Provider not found!" });
      }
      if (!provider.stockWatches) {
        res.status(404).send({ message: "Stock watches not found!" });
      }
      const watch = provider.stockWatches.find(
        (w) => w.watchID === parseInt(watchID)
      );
      if (!watch) {
        res.status(404).send({ message: "Stock watch not found!" });
      }
      Object.keys(updateWatch).map((key) => {
        if (watch.hasOwnProperty(key)) {
          watch[key] = updateWatch[key];
        } else {
          res
            .status(404)
            .send({ message: `Stock watch does not have ${key}!` });
        }
      });
      await redisClient.set(key, JSON.stringify(Providers));
      res.status(200).send({ message: "Stock watch updated successfully!" });
    } catch (error) {
      console.error(error);
      res.status(500).send({ message: "Error updating stock watch!" });
    }
  }
);

// DELETE / Delete stock watch from provider
app.delete(
  "/watch_providers/provider/:providerID/stock_watch/:watchID",
  async (req, res) => {
    const { providerID, watchID } = req.params;
    const key = "Providers";
    try {
      let Providers = await redisClient.get(key);
      if (!Providers) {
        res.status(404).send({ message: "Providers not found!" });
        return;
      }
      Providers = JSON.parse(Providers);
      let provider = Providers[`provider_${providerID}`];
      if (!provider) {
        res.status(404).send({ message: "Provider not found!" });
      }
      if (!provider.stockWatches) {
        res.status(404).send({ message: "Stock watches not found!" });
      }
      const watchIndex = provider.stockWatches.findIndex(
        (w) => w.watchID === parseInt(watchID)
      );
      if (watchIndex === -1) {
        res.status(404).send({ message: "Stock watch not found!" });
        return;
      }
      provider.stockWatches.splice(watchIndex, 1);
      await redisClient.set(key, JSON.stringify(Providers));
      res.status(200).send({ message: "Stock watch deleted successfully!" });
    } catch (error) {
      console.error(error);
      res.status(500).send({ message: "Error deliting stock watch!" });
    }
  }
);

// POST / Create Transactions
app.post("/watch_transactions", async (req, res) => {
  const key = "Transactions";
  const data = {};

  try {
    const transactions = await redisClient.get(key);
    if (!transactions) {
      await redisClient.set(key, JSON.stringify(data));
      res.status(201).send({ message: "Transactions saved successfully!" });
    } else {
      res.status(200).send({ message: "Transactions already exist!" });
    }
  } catch (error) {
    console.error(error);
    res.status(500).send({ message: "Error saving Transactions!" });
  }
});

// GET /transactions
app.get("/watch_transactions", async (req, res) => {
  try {
    const Transactions = await redisClient.get("Transactions");
    if (!Transactions) {
      res.status(404).send({ message: "Transactions not found!" });
    } else {
      res.status(200).send({ Transactions: JSON.parse(Transactions) });
    }
  } catch (error) {
    console.error(error);
    res.status(500).send({ message: "Error retrieving data!" });
  }
});

// POST /watch_collections/transaction
app.post("/watch_collections/transaction", async (req, res) => {
  const { sellerCollectionID, buyerCollectionID, watchID } = req.body;

  try {
    let Collections = await redisClient.get("Collections");
    if (!Collections) {
      res.status(404).send({ message: "Collections not found!" });
      return;
    }
    Collections = JSON.parse(Collections);

    const sellerCollection = Collections[`collectionID_${sellerCollectionID}`];
    if (!sellerCollection) {
      res.status(404).send({ message: "Seller's collection not found!" });
      return;
    }
    const watch = sellerCollection.watches.find(
      (w) => w.watchID === parseInt(watchID)
    );
    if (!watch) {
      res
        .status(404)
        .send({ message: "Watch not found in seller's collection!" });
      return;
    }
    const buyerCollection = Collections[`collectionID_${buyerCollectionID}`];
    if (!buyerCollection) {
      res.status(404).send({ message: "Buyer's collection not found!" });
      return;
    }
    buyerCollection.watches.push(watch);

    const watchIndex = sellerCollection.watches.findIndex(
      (w) => w.watchID === parseInt(watchID)
    );
    sellerCollection.watches.splice(watchIndex, 1);

    await redisClient.set("Collections", JSON.stringify(Collections));
    const transaction = {
      sellerCollectionID,
      buyerCollectionID,
      watchID,
    };
    let Transactions = await redisClient.get("Transactions");
    if (!Transactions) {
      Transactions = {};
    } else {
      Transactions = JSON.parse(Transactions);
    }
    Transactions[`transactionID_${watchID}`] = transaction;
    await redisClient.set("Transactions", JSON.stringify(Transactions));
    res.status(201).send({ message: "Transaction completed successfully!" });
  } catch (error) {
    console.error(error);
    res.status(500).send({ message: "Error completing transaction!" });
  }
});

app.listen(process.env.EXPRESS_PORT, () => {
  console.log(
    `Application running on port ${process.env.EXPRESS_HOST}:${process.env.EXPRESS_PORT} !`
  );
});
