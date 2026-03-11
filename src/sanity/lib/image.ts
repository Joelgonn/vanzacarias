// src/sanity/lib/image.ts
import imageUrlBuilder from '@sanity/image-url';
import { SanityImageSource } from "@sanity/image-url/lib/types/types"; // Para tipagem
import { dataset, projectId } from '../env'; // Pega as mesmas config do client

const builder = imageUrlBuilder({
  projectId: projectId!, // Usa o Project ID do .env
  dataset: dataset!,     // Usa o Dataset do .env
});

export const urlFor = (source: SanityImageSource) => {
  return builder.image(source);
};