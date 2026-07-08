export default function Home() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-2 p-16 text-center">
      <h1 className="text-3xl font-semibold tracking-tight">Navtrack</h1>
      <p className="text-muted-foreground max-w-md">
        Khung hạ tầng đã sẵn sàng. Các tính năng (đăng nhập, danh mục, XIRR...)
        sẽ được xây ở các phase tiếp theo — xem{" "}
        <code className="font-mono">process/PROCESS.md</code>.
      </p>
    </div>
  );
}
