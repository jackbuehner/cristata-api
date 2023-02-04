declare module 'bson/lib/bson/parser/calculate_size' {
  export interface CalculateObjectSizeOptions {
    /** {default:false}, serialize the javascript functions */
    serializeFunctions?: boolean | undefined;
    /** {default:true}, ignore undefined fields. */
    ignoreUndefined?: boolean | undefined;
  }

  /**
   * Calculate the bson size for a passed in Javascript object.
   *
   * @param {Object} object the Javascript object to calculate the BSON byte size for.
   * @param {CalculateObjectSizeOptions} options
   * @return {Number} returns the number of bytes the BSON object will take up.
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  export default function calculateObjectSize(object: any, options?: CalculateObjectSizeOptions): number;
}
