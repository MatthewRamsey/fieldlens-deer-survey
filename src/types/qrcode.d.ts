declare module "qrcode" {
  type QRCodeOptions = {
    margin?: number;
    width?: number;
    color?: {
      dark?: string;
      light?: string;
    };
  };

  const QRCode: {
    toDataURL(text: string, options?: QRCodeOptions): Promise<string>;
  };

  export default QRCode;
}
