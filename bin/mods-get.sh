 wget -O ./built/zef-mods.json https://360.zef.pm/
 wget -O - https://raw.githubusercontent.com/Raku/ecosystem/master/META.list | xargs -P 1 -n 1 sh -c 'wget -O -  $0' | jq -s ./built/ecosystem.json
 # jq -r  '.[] | ."source-url" //.support.source | "(cd ./work_mods/all && git clone  \(.))"' < ./built/ecosystem.json  | sh
 #jq -r  '.[] | "(cd ./work_mods/all && git clone  \(."source-url" //.support.source ) )"' < ./built/ecosystem.json  | sh
jq -r  '.[] | "(cd ./work_mods/all && git clone  \(."source-url" //.support.source ) \(.name) )"' < ./built/ecosystem.json
 jq -r  '.[]| "(cd ./work_mods/zef; mkdir \(.name) && wget -O - https://360.zef.pm/\(.path)  | tar xzf - -C \(.name))" ' < ./built/mods.json | sh
# Show all extensions
# find ./work_mods -type f | perl -ne 'print $1 if m/\.([^.\/]+)$/' | sort | uniq -c | sort -n
node ./bin/parsesrc.mjs 'work_mods/**/*.{pod6,md,rakudoc,rakumod,raku,pm6}' > /dev/null    