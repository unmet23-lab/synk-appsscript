// HWP 파일 상자(OLE)를 새로 만들되 모든 스트림을 원본 바이트 그대로 옮기고, 지시한 스트림만 바꾸거나 더한다.
// 재도전 사업계획서 작업(2026-10-19~21)의 Repack.java(스트림 하나만 바꿈)를 여러 개로 늘린 판. 상자 쓰기는 hwplib 안의 POIFS(아파치 POI).
// 사용: java -Dfile.encoding=UTF-8 -cp tools/lib/hwp/hwplib-1.1.9.jar tools/lib/hwp/RepackMulti.java <원본.hwp> <지시.tsv> <새파일.hwp>
//   지시 줄: REPLACE<TAB>스트림 경로<TAB>새 파일  — 원본에 있는 스트림을 바꾼다(정확히 한 번 만나야 한다)
//            ADD<TAB>스트림 경로<TAB>새 파일      — 원본에 없는 스트림을 더한다(부모 저장소는 있어야 한다)
// tools/hwp쪽배치.py가 측정용 사본을 만들 때 부른다. 새 파일은 <새파일>.part에 다 쓴 뒤 옮긴다(뷰어가 잡은 파일이면 옮기기에서 실패한다).
import kr.dogfoot.hwplib.org.apache.poi.poifs.filesystem.DirectoryEntry;
import kr.dogfoot.hwplib.org.apache.poi.poifs.filesystem.DirectoryNode;
import kr.dogfoot.hwplib.org.apache.poi.poifs.filesystem.DocumentEntry;
import kr.dogfoot.hwplib.org.apache.poi.poifs.filesystem.Entry;
import kr.dogfoot.hwplib.org.apache.poi.poifs.filesystem.NPOIFSFileSystem;
import kr.dogfoot.hwplib.org.apache.poi.poifs.filesystem.POIFSFileSystem;

import java.io.ByteArrayInputStream;
import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.util.Iterator;
import java.util.LinkedHashMap;
import java.util.Map;

public class RepackMulti {
    static final Map<String, byte[]> replace = new LinkedHashMap<>(), add = new LinkedHashMap<>();
    static final Map<String, Integer> hit = new LinkedHashMap<>();
    static int copied = 0;

    public static void main(String[] a) throws Exception {
        File in = new File(a[0]), out = new File(a[2]);
        if (out.exists() && Files.isSameFile(in.toPath(), out.toPath())) throw new IllegalArgumentException("원본에 덮어쓰지 않는다");
        for (String ln : Files.readAllLines(new File(a[1]).toPath(), StandardCharsets.UTF_8)) {
            if (ln.isBlank()) continue;
            String[] t = ln.split("\t");
            if (t.length != 3) throw new IllegalArgumentException("지시 줄 모양이 다르다: " + ln);
            byte[] data = Files.readAllBytes(new File(t[2]).toPath());
            switch (t[0]) {
                case "REPLACE" -> { replace.put(t[1], data); hit.put(t[1], 0); }
                case "ADD" -> add.put(t[1], data);
                default -> throw new IllegalArgumentException("모르는 지시: " + t[0]);
            }
        }
        try (NPOIFSFileSystem src = new NPOIFSFileSystem(in, true)) {
            POIFSFileSystem dst = new POIFSFileSystem();
            copyDir(src.getRoot(), dst.getRoot(), "");
            for (var e : hit.entrySet()) if (e.getValue() != 1) throw new IllegalStateException("바꿀 스트림을 " + e.getValue() + "번 만났다: " + e.getKey());
            for (var e : add.entrySet()) {
                String p = e.getKey();
                int cut = p.lastIndexOf('/');
                DirectoryEntry dir = dst.getRoot();
                if (cut >= 0) {
                    for (String part : p.substring(0, cut).split("/")) {
                        if (!dir.hasEntry(part)) throw new IllegalStateException("더할 자리의 저장소가 없다: " + p);
                        dir = (DirectoryEntry) dir.getEntry(part);
                    }
                }
                String name = p.substring(cut + 1);
                if (dir.hasEntry(name)) throw new IllegalStateException("이미 있는 스트림이다: " + p);
                dir.createDocument(name, new ByteArrayInputStream(e.getValue()));
            }
            File tmp = new File(out.getPath() + ".part");
            try (FileOutputStream fo = new FileOutputStream(tmp)) { dst.writeFilesystem(fo); }
            Files.move(tmp.toPath(), out.toPath(), java.nio.file.StandardCopyOption.REPLACE_EXISTING);
        }
        System.out.println("스트림 " + copied + "개 그대로 · 바꿈 " + replace.size() + "개 " + replace.keySet() + " · 더함 " + add.size() + "개 " + add.keySet() + " → " + out.getPath() + " (" + out.length() + " 바이트)");
    }

    static void copyDir(DirectoryNode from, DirectoryEntry to, String path) throws Exception {
        to.setStorageClsid(from.getStorageClsid());
        for (Iterator<Entry> it = from.getEntries(); it.hasNext(); ) {
            Entry e = it.next();
            String p = path.isEmpty() ? e.getName() : path + "/" + e.getName();
            if (e instanceof DirectoryNode d) {
                copyDir(d, to.createDirectory(e.getName()), p);
            } else if (e instanceof DocumentEntry) {
                byte[] data;
                if (replace.containsKey(p)) { data = replace.get(p); hit.merge(p, 1, Integer::sum); }
                else {
                    try (InputStream is = from.createDocumentInputStream(e)) { data = is.readAllBytes(); }
                    copied++;
                }
                to.createDocument(e.getName(), new ByteArrayInputStream(data));
            }
        }
    }
}
