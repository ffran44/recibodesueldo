export class SinApiKey extends Error {
  constructor(servicio: string) {
    super(`Falta tu API key de ${servicio}. Cargala en Ajustes.`)
  }
}
