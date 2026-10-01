declare module "qrcode" {
  type QRCodeOptions = {
    margin?: number;
    width?: number;
    type?: "svg";
    errorCorrectionLevel?: "L" | "M" | "Q" | "H";
    color?: {
      dark?: string;
      light?: string;
    };
  };

  const QRCode: {
    toDataURL(text: string, options?: QRCodeOptions): Promise<string>;
    toString(text: string, options?: QRCodeOptions): Promise<string>;
  };

  export default QRCode;
}
