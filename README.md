# rustdisk deno library

This is a Deno library that provides an interface to the `rustdisk` library, which is a Rust library for getting disk usage and mount information.

```sh
cargo build --release
```

## Usage

To use the `rustdisk` library in Deno, you need to import the library and call its functions. Here is an example of how to do this:

```ts
  // rustdisk deno import
  const lib = Deno.dlopen("./target/release/librustdisk.so", {
    "get_disk_usage": { parameters: ["pointer"], result: "pointer" },
    "free_disk_usage": { parameters: ["pointer"], result: "void" },
    "get_mounts": { parameters: [], result: "pointer" },
    "free_mounts": { parameters: ["pointer"], result: "void" },
  });
```

## Example of getting disk usage and mounts

```ts
  // rustdisk deno import
  const lib = Deno.dlopen("./target/release/librustdisk.so", {
    "get_disk_usage": { parameters: ["pointer"], result: "pointer" },
    "free_disk_usage": { parameters: ["pointer"], result: "void" },
  });

  // get disk usage
  const diskpath = "/"
  const pathBuffer = new TextEncoder().encode(diskpath + "\0"); // null-terminated string
  const pathPointer = Deno.UnsafePointer.of(pathBuffer); // pointer to the string
  const usagePtr = lib.symbols.get_disk_usage(pathPointer); // pointer to DiskUsage struct
  if (usagePtr === null) throw new Error("Failed to get disk usage"); // check for null pointer
  const usageView = new Deno.UnsafePointerView(usagePtr); // create a view of the pointer
  const total = usageView.getBigUint64(0); // total size
  const free = usageView.getBigUint64(8); // free size
  const used = usageView.getBigUint64(16); // used size
  lib.symbols.free_disk_usage(usagePtr); // free the pointer

  console.log(`Disk usage for ${diskpath}:`); 
  console.log(`Total: ${total}`);
  console.log(`Free: ${free}`);
  console.log(`Used: ${used}`);
```

## Example output disk usage

```console
Disk usage for /:
Total: 514907488256
Free: 480469094400
Used: 34438393856
```

## Example of getting mounts

```ts
  // rustdisk deno import
  const lib = Deno.dlopen("./target/release/librustdisk.so", {
    "get_mounts": { parameters: [], result: "pointer" },
    "free_mounts": { parameters: ["pointer"], result: "void" },
  });
  // get mounts
  const mountsPtr = lib.symbols.get_mounts();
  if (mountsPtr === null) throw new Error("get_mounts() returned null");

  const view = new Deno.UnsafePointerView(mountsPtr);
  const mountsPtrInner = view.getPointer(0); // MountInfo *
  const length = view.getBigUint64(8); // usize

  const mounts = [];

  for (let i = 0n; i < length; i++) {
    const offset = Number(i) * 16; // size of MountInfo struct (two pointers)
    const mountView = new Deno.UnsafePointerView(mountsPtrInner!);
    const devicePtr = mountView.getPointer(offset);
    const mountPointPtr = mountView.getPointer(offset + 8);
    const device = new Deno.UnsafePointerView(devicePtr!).getCString();
    const mountPoint = new Deno.UnsafePointerView(mountPointPtr!).getCString();
    mounts.push({ device, mountPoint });
  }

  console.log(mounts.filter(mount => mount.device.includes("/dev")));

  // Free the mounts pointer
  lib.symbols.free_mounts(mountsPtr);
  lib.close();
```

## Example output mounts

```console
[
  { device: '/dev/sda1', mountPoint: '/' },
  { device: '/dev/sda2', mountPoint: '/home' }
]

```console
[
  { device: '/dev/sda1', mountPoint: '/' },
  { device: '/dev/sda2', mountPoint: '/home' }
]
```
