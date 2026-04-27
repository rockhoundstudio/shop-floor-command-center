import { useState, useEffect } from "react";
import { json } from "@remix-run/node";
import { useLoaderData, useFetcher, useSubmit, useNavigation } from "@remix-run/react";
import {
  Page,
  Layout,
  Card,
  Tabs,
  IndexTable,
  useIndexResourceState,
  Badge,
  Button,
  BlockStack,
  InlineStack,
  Text,
  ProgressBar,
  Checkbox,
  TextField,
  Scrollable,
  Box,
  Divider
} from "@shopify/polaris";

const METAFIELD_NAMESPACE = "custom";
const METAFIELDS = [
  { key: "crystal_structure", label: "Crystal Structure" },
  { key: "mineral_class", label: "Mineral Class" },
  { key: "rock_formation", label: "Rock Formation" },
  { key: "geological_era", label: "Geological Era" },
  { key: "rock_composition", label: "Rock Composition" },
  { key: "hardness", label: "Hardness" },
  { key: "where_found", label: "Where Found" },
  { key: "geological_age", label: "Geological Age" },
  { key: "character_marks", label: "Character Marks" },
  { key: "stone_story", label: "Stone Story" },
  { key: "rescued_by", label: "Rescued By" },
  { key: "origin_location", label: "Origin Location" }
];