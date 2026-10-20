// Windows-only controlled diagnostic helper. Build with the installed .NET Framework compiler.
// All identities/handles/job names travel through private pipes, never public diagnostic events.
using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.IO;
using System.Runtime.InteropServices;
using System.Text;
using System.Threading;
using System.Threading.Tasks;
using System.Web.Script.Serialization;
using Microsoft.Win32.SafeHandles;

internal static class NativeSampling {
  const uint QueryJob = 4, TerminateJob = 8, CreateSuspended = 4, NoWindow = 0x08000000;
  const uint KillOnClose = 0x2000, Signaled = 0, Inherit = 1, StartHandles = 0x100;
  static readonly object Gate = new object();
  static readonly ManualResetEvent Finished = new ManualResetEvent(false);
  static IntPtr ownedJob;
  static int stage;
  static readonly JavaScriptSerializer Json = new JavaScriptSerializer { MaxJsonLength = 16384 };
  [StructLayout(LayoutKind.Sequential)] struct IoCounters { public ulong a,b,c,d,e,f; }
  [StructLayout(LayoutKind.Sequential)] struct BasicLimit { public long a,b; public uint Flags; public UIntPtr c,d; public uint e; public UIntPtr f; public uint g,h; }
  [StructLayout(LayoutKind.Sequential)] struct ExtendedLimit { public BasicLimit Basic; public IoCounters Io; public UIntPtr a,b,c,d; }
  [StructLayout(LayoutKind.Sequential, CharSet=CharSet.Unicode)] struct Startup { public uint Size; public string a,b,c; public uint d,e,f,g,h,i,j,k; public ushort l,m; public IntPtr n; public IntPtr Input,Output,Error; }
  [StructLayout(LayoutKind.Sequential)] struct StartupEx { public Startup Start; public IntPtr Attributes; }
  [StructLayout(LayoutKind.Sequential)] struct ProcessInfo { public IntPtr Process,Thread; public uint Id,ThreadId; }
  [StructLayout(LayoutKind.Sequential)] struct Security { public int Size; public IntPtr Descriptor; public int Inherit; }
  [DllImport("kernel32", CharSet=CharSet.Unicode, SetLastError=true)] static extern IntPtr CreateJobObject(IntPtr security, string name);
  [DllImport("kernel32", CharSet=CharSet.Unicode, SetLastError=true)] static extern IntPtr OpenJobObject(uint access, bool inherit, string name);
  [DllImport("kernel32", SetLastError=true)] static extern bool SetInformationJobObject(IntPtr job, int info, ref ExtendedLimit data, uint size);
  [DllImport("kernel32", SetLastError=true)] static extern bool InitializeProcThreadAttributeList(IntPtr list, int count, uint flags, ref IntPtr size);
  [DllImport("kernel32", SetLastError=true)] static extern bool UpdateProcThreadAttribute(IntPtr list, uint flags, UIntPtr attribute, IntPtr value, UIntPtr size, IntPtr previous, IntPtr returned);
  [DllImport("kernel32")] static extern void DeleteProcThreadAttributeList(IntPtr list);
  [DllImport("kernel32", SetLastError=true)] static extern bool TerminateJobObject(IntPtr job, uint code);
  [DllImport("kernel32", SetLastError=true)] static extern bool QueryInformationJobObject(IntPtr job, int info, IntPtr data, uint size, out uint returned);
  [DllImport("kernel32", SetLastError=true)] static extern bool CreatePipe(out IntPtr read, out IntPtr write, ref Security security, uint size);
  [DllImport("kernel32", SetLastError=true)] static extern bool SetHandleInformation(IntPtr handle, uint mask, uint flags);
  [DllImport("kernel32", CharSet=CharSet.Unicode, SetLastError=true)] static extern bool CreateProcess(string app, StringBuilder command, IntPtr pa, IntPtr ta, bool inherit, uint flags, IntPtr env, string cwd, ref StartupEx start, out ProcessInfo info);
  [DllImport("kernel32", CharSet=CharSet.Unicode, SetLastError=true)] static extern IntPtr CreateFile(string path, uint access, uint share, ref Security security, uint creation, uint flags, IntPtr template);
  [DllImport("kernel32", SetLastError=true)] static extern uint ResumeThread(IntPtr thread);
  [DllImport("kernel32", SetLastError=true)] static extern bool TerminateProcess(IntPtr process, uint code);
  [DllImport("kernel32")] static extern uint WaitForSingleObject(IntPtr handle, uint ms);
  [DllImport("kernel32", SetLastError=true)] static extern bool GetProcessTimes(IntPtr process, out long created, out long exited, out long kernel, out long user);
  [DllImport("kernel32", SetLastError=true)] static extern bool GetExitCodeProcess(IntPtr process, out uint code);
  [DllImport("kernel32")] static extern IntPtr GetStdHandle(int value);
  [DllImport("kernel32")] static extern bool CloseHandle(IntPtr handle);
  static void Require(bool value) { if (!value) throw new InvalidOperationException("private operation unavailable"); }
  static string Created(IntPtr process) { long c,e,k,u; Require(GetProcessTimes(process,out c,out e,out k,out u)); return DateTime.FromFileTimeUtc(c).Ticks.ToString(); }
  static Dictionary<string,object> Map(params object[] values) { var d=new Dictionary<string,object>(); for(int i=0;i<values.Length;i+=2)d.Add((string)values[i],values[i+1]); return d; }
  static void Frame(object value) { var text=Json.Serialize(value); Require(Encoding.UTF8.GetByteCount(text)<=12000); Console.WriteLine(text); Console.Out.Flush(); }
  static uint[] MemberIds(IntPtr job) {
    // A closed Job Object boundary, not a ParentPID/name heuristic. Reject unbounded jobs.
    IntPtr data=Marshal.AllocHGlobal(8+32*IntPtr.Size); uint returned;
    try { Require(QueryInformationJobObject(job,3,data,(uint)(8+32*IntPtr.Size),out returned)); uint assigned=(uint)Marshal.ReadInt32(data),listed=(uint)Marshal.ReadInt32(data,4); Require(assigned==listed && listed<=32);var ids=new uint[listed];for(int i=0;i<listed;i++)ids[i]=(uint)Marshal.ReadIntPtr(data,8+i*IntPtr.Size).ToInt64();return ids; }
    finally { Marshal.FreeHGlobal(data); }
  }
  static uint Members(IntPtr job) { return (uint)MemberIds(job).Length; }
  static void EndJob() { lock(Gate) { if(ownedJob!=IntPtr.Zero) { TerminateJobObject(ownedJob,126); CloseHandle(ownedJob); ownedJob=IntPtr.Zero; } } }
  static string ReadBounded(Stream stream) {
    using(var reader=new StreamReader(stream,new UTF8Encoding(false,true))) {
      var text=new StringBuilder(); var chars=new char[512]; int n;
      while((n=reader.Read(chars,0,chars.Length))>0) { text.Append(chars,0,n); Require(Encoding.UTF8.GetByteCount(text.ToString())<=8192); }
      return text.ToString();
    }
  }
  const string SampleScript = "$ErrorActionPreference='Stop';$c=@(Get-NetTCPConnection -ErrorAction Stop);[ordered]@{listen=@($c|Where-Object {$_.LocalPort -eq 4173 -and $_.State -eq 'Listen'}).Count;synSent=@($c|Where-Object {($_.LocalPort -eq 4173 -or $_.RemotePort -eq 4173) -and $_.State -eq 'SynSent'}).Count;synReceived=@($c|Where-Object {($_.LocalPort -eq 4173 -or $_.RemotePort -eq 4173) -and $_.State -eq 'SynReceived'}).Count;established=@($c|Where-Object {($_.LocalPort -eq 4173 -or $_.RemotePort -eq 4173) -and $_.State -eq 'Established'}).Count;globalSynSent=@($c|Where-Object {$_.State -eq 'SynSent'}).Count}|ConvertTo-Json -Compress";
  static object RunWorker(string mode, Task<string> cancelled) {
    stage=4;
    string script=mode=="sample" ? SampleScript : mode=="hold" ? "[Threading.Thread]::Sleep(25000)" : "Write-Output '{\"listen\":0,\"synSent\":0,\"synReceived\":0,\"established\":0,\"globalSynSent\":0,\"canary\":\"NATIVE-SECRET-CANARY-198.51.100.77\"}'";
    script="$ProgressPreference='SilentlyContinue';[Console]::OutputEncoding=[Text.UTF8Encoding]::new($false);"+script;
    string powershell=Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.System),"WindowsPowerShell\\v1.0\\powershell.exe");
    string command="\""+powershell+"\" -NoLogo -NoProfile -NonInteractive -EncodedCommand "+Convert.ToBase64String(Encoding.Unicode.GetBytes(script));
    var security=new Security { Size=Marshal.SizeOf(typeof(Security)), Inherit=1 };
    IntPtr read=IntPtr.Zero,write=IntPtr.Zero,input=IntPtr.Zero,attributes=IntPtr.Zero,jobValue=IntPtr.Zero,handleValues=IntPtr.Zero; bool attributesReady=false; ProcessInfo worker=new ProcessInfo();
    try {
      Require(CreatePipe(out read,out write,ref security,0)); Require(SetHandleInformation(read,Inherit,0));
      input=CreateFile("NUL",0x80000000,3,ref security,3,0,IntPtr.Zero);Require(input!=new IntPtr(-1));
      IntPtr size=IntPtr.Zero;InitializeProcThreadAttributeList(IntPtr.Zero,2,0,ref size);
      attributes=Marshal.AllocHGlobal(size);Require(InitializeProcThreadAttributeList(attributes,2,0,ref size));
      attributesReady=true;
      jobValue=Marshal.AllocHGlobal(IntPtr.Size);Marshal.WriteIntPtr(jobValue,ownedJob);
      handleValues=Marshal.AllocHGlobal(2*IntPtr.Size);Marshal.WriteIntPtr(handleValues,input);Marshal.WriteIntPtr(handleValues,IntPtr.Size,write);
      Require(UpdateProcThreadAttribute(attributes,0,new UIntPtr(0x0002000D),jobValue,new UIntPtr((uint)IntPtr.Size),IntPtr.Zero,IntPtr.Zero));
      Require(UpdateProcThreadAttribute(attributes,0,new UIntPtr(0x00020002),handleValues,new UIntPtr((uint)(2*IntPtr.Size)),IntPtr.Zero,IntPtr.Zero));
      var startup=new StartupEx { Start=new Startup { Size=(uint)Marshal.SizeOf(typeof(StartupEx)),k=StartHandles,Input=input,Output=write,Error=write },Attributes=attributes };
      // Kernel creation-time job list removes the create-then-assign orphan window entirely.
      Require(CreateProcess(powershell,new StringBuilder(command),IntPtr.Zero,IntPtr.Zero,true,CreateSuspended|NoWindow|0x00080000,IntPtr.Zero,null,ref startup,out worker));
      stage=5;
      Frame(Map("frame","worker","processId",worker.Id,"createdUtcTicks",Created(worker.Process)));
      if(mode=="suspended")Thread.Sleep(5000);
      Require(ResumeThread(worker.Thread)!=UInt32.MaxValue); CloseHandle(worker.Thread); worker.Thread=IntPtr.Zero;
      stage=6;
      CloseHandle(write); write=IntPtr.Zero;
      var stream=new FileStream(new SafeFileHandle(read,true),FileAccess.Read); read=IntPtr.Zero;
      var output=Task.Factory.StartNew(()=>ReadBounded(stream));
      Frame(Map("frame","started"));
      while(WaitForSingleObject(worker.Process,20)!=Signaled || !output.IsCompleted) {
        if(cancelled.IsCompleted) { TerminateJobObject(ownedJob,125); throw new OperationCanceledException(); }
      }
      stage=7;uint code; Require(GetExitCodeProcess(worker.Process,out code) && code==0);
      stage=8;Require(!output.IsFaulted);
      stage=9;Require(Members(ownedJob)==0);
      stage=10;
      return Map("frame","result","raw",output.Result);
    } finally {
      // This also handles failures before the kernel-owned suspended worker is resumed.
      if(worker.Process!=IntPtr.Zero) { if(WaitForSingleObject(worker.Process,0)!=Signaled)TerminateProcess(worker.Process,127); WaitForSingleObject(worker.Process,3000); CloseHandle(worker.Process); }
      if(worker.Thread!=IntPtr.Zero)CloseHandle(worker.Thread);
      if(write!=IntPtr.Zero)CloseHandle(write); if(read!=IntPtr.Zero)CloseHandle(read);
      if(input!=IntPtr.Zero && input!=new IntPtr(-1))CloseHandle(input);
      if(attributes!=IntPtr.Zero){if(attributesReady)DeleteProcThreadAttributeList(attributes);Marshal.FreeHGlobal(attributes);}
      if(jobValue!=IntPtr.Zero)Marshal.FreeHGlobal(jobValue);if(handleValues!=IntPtr.Zero)Marshal.FreeHGlobal(handleValues);
    }
  }
  static object Inspect(Dictionary<string,object> control) {
    var target=(Dictionary<string,object>)control["target"];
    int id=Convert.ToInt32(target["processId"]); string ticks=(string)target["createdUtcTicks"],jobName=(string)target["jobName"];
    Require(id>1 && ticks.Length>=18 && ticks.Length<=20 && jobName.StartsWith("Local\\KingTurfSampling-",StringComparison.Ordinal) && jobName.Length==59);
    bool stop=(bool)control["terminate"], matched=false,gone=false,terminated=false; int polls=0;
    Process root=null,child=null; IntPtr job=IntPtr.Zero;
    bool workerRegistered=target.ContainsKey("worker"),workerGone=!workerRegistered,workerMatched=false;
    try {
      try { root=Process.GetProcessById(id); } catch(ArgumentException) { gone=true; }
      if(root!=null) {
        // The cached native handle pins identity; all times, wait and termination use this handle.
        IntPtr handle=root.Handle;
        matched=Created(handle)==ticks; Require(matched);
        if(WaitForSingleObject(handle,0)!=Signaled) Require(String.Equals(root.MainModule.FileName,System.Reflection.Assembly.GetExecutingAssembly().Location,StringComparison.OrdinalIgnoreCase));
        gone=WaitForSingleObject(handle,0)==Signaled;
      }
      if(workerRegistered) {
        var worker=(Dictionary<string,object>)target["worker"];
        try { child=Process.GetProcessById(Convert.ToInt32(worker["processId"])); } catch(ArgumentException) { workerGone=true; }
        if(child!=null) {
          IntPtr workerHandle=child.Handle;
          workerMatched=Created(workerHandle)==(string)worker["createdUtcTicks"];Require(workerMatched);
          if(WaitForSingleObject(workerHandle,0)!=Signaled)
            Require(String.Equals(child.MainModule.FileName,Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.System),"WindowsPowerShell\\v1.0\\powershell.exe"),StringComparison.OrdinalIgnoreCase));
          workerGone=WaitForSingleObject(workerHandle,0)==Signaled;
        }
      }
      job=OpenJobObject(QueryJob|TerminateJob,false,jobName);
      if(job==IntPtr.Zero)Require(Marshal.GetLastWin32Error()==2);
      if(child!=null && WaitForSingleObject(child.Handle,0)!=Signaled)Require(job!=IntPtr.Zero && Array.IndexOf(MemberIds(job),(uint)child.Id)>=0);
      if(stop) {
        if(root!=null && !gone) { Require(TerminateProcess(root.Handle,125)); terminated=true; }
        if(root!=null)Require(WaitForSingleObject(root.Handle,10000)==Signaled);
        if(job!=IntPtr.Zero) {
          if(control.ContainsKey("rootOnly") && (bool)control["rootOnly"]) { CloseHandle(job);job=IntPtr.Zero; }
          else Require(TerminateJobObject(job,125));
        }
      }
      var watch=Stopwatch.StartNew();
      while(watch.ElapsedMilliseconds<10000) {
        gone=root==null || WaitForSingleObject(root.Handle,0)==Signaled;
        workerGone=child==null || WaitForSingleObject(child.Handle,0)==Signaled;
        if(control.ContainsKey("observeOnly") && (bool)control["observeOnly"])break;
        if(gone && workerGone && (job==IntPtr.Zero || Members(job)==0))break;
        polls++;Thread.Sleep(50);
      }
      uint members=job==IntPtr.Zero?0:Members(job);
      return Map("frame","result","raw",Json.Serialize(Map("matched",matched,"gone",gone,"nativeChildren",members,"polls",polls,"terminated",terminated,"workerRegistered",workerRegistered,"workerGone",workerGone,"workerMatched",workerMatched)));
    } finally { if(job!=IntPtr.Zero)CloseHandle(job); if(root!=null)root.Dispose();if(child!=null)child.Dispose(); }
  }
  public static int Main() {
    Console.OutputEncoding=new UTF8Encoding(false);
    string jobName="Local\\KingTurfSampling-"+Guid.NewGuid().ToString("D");
    try {
      // Arm before any pipe flush or native setup; a failed setup still has private root identity.
      stage=1;
      var watchdog=new Thread(()=>{ if(!Finished.WaitOne(30000)) { EndJob(); Environment.Exit(124); } });watchdog.IsBackground=true;watchdog.Start();
      using(var root=Process.GetCurrentProcess()) Frame(Map("frame","identity","processId",root.Id,"createdUtcTicks",Created(root.Handle),"jobName",jobName));
      ownedJob=CreateJobObject(IntPtr.Zero,jobName); Require(ownedJob!=IntPtr.Zero && Marshal.GetLastWin32Error()!=183);
      stage=2;
      var limits=new ExtendedLimit();limits.Basic.Flags=KillOnClose;
      Require(SetInformationJobObject(ownedJob,9,ref limits,(uint)Marshal.SizeOf(typeof(ExtendedLimit))));
      var input=Task.Factory.StartNew(()=>Console.ReadLine());
      while(!input.IsCompleted)Thread.Sleep(20);
      Require(input.Result!=null && Encoding.UTF8.GetByteCount(input.Result)<=4096);
      var control=Json.Deserialize<Dictionary<string,object>>(input.Result);string mode=(string)control["mode"];
      stage=3;
      Require(mode=="sample" || mode=="canary" || mode=="hold" || mode=="suspended" || mode=="inspect");
      var cancelled=Task.Factory.StartNew(()=>Console.ReadLine());
      if(mode=="inspect") { Frame(Map("frame","started")); Frame(Inspect(control)); } else Frame(RunWorker(mode,cancelled));
      return 0;
    } catch { try { Frame(Map("frame","failed","stage",stage)); } catch { /* No raw error output. */ } return 1; }
    finally { Finished.Set(); EndJob(); }
  }
}
