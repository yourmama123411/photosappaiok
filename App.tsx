import React, { useEffect, useMemo, useState } from 'react';
import { Alert, FlatList, Image, Modal, Pressable, SafeAreaView, ScrollView, StatusBar, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import { Asset } from 'expo-media-library';
import { loadRecentPhotos } from './src/services/photos';
import { configureNotifications, scheduleTaskNotification } from './src/services/notifications';
import { createCalendarEvent } from './src/services/calendar';
import { shareLocalFile } from './src/services/sharing';
import { createTaskFromText, describePhoto } from './src/services/localAI';
import { getDB } from './src/storage/db';

type Tab = 'photos' | 'tasks' | 'notes' | 'calendar' | 'settings';
type MenuPhoto = Asset | null;

const C = { bg:'#08090b', panel:'rgba(28,29,34,.88)', line:'rgba(255,255,255,.09)', text:'#f5f5f7', muted:'#96979f', accent:'#8ab4ff' };

export default function App() {
  const [tab,setTab]=useState<Tab>('photos');
  const [photos,setPhotos]=useState<Asset[]>([]);
  const [menuPhoto,setMenuPhoto]=useState<MenuPhoto>(null);
  const [radius,setRadius]=useState(18);
  const [tasks,setTasks]=useState<{id:number,title:string,done:number}[]>([]);
  const [notes,setNotes]=useState<string[]>([]);
  const [note,setNote]=useState('');
  const [task,setTask]=useState('');
  const [aiBusy,setAiBusy]=useState(false);
  const [notifications,setNotifications]=useState(true);
  const [people,setPeople]=useState<string[]>([]);
  const [personName,setPersonName]=useState('');
  const [searchOpen,setSearchOpen]=useState(false);
  const [query,setQuery]=useState('');

  useEffect(()=>{
    configureNotifications();
    loadRecentPhotos(90).then(setPhotos).catch(()=>setPhotos([]));
    getDB().then(async db=>{
      const rows=await db.getAllAsync<{id:number,title:string,done:number}>('SELECT id,title,done FROM tasks ORDER BY id DESC');
      const ns=await db.getAllAsync<{text:string}>('SELECT text FROM notes ORDER BY id DESC');
      const ps=await db.getAllAsync<{name:string}>('SELECT name FROM people ORDER BY name');
      setTasks(rows); setNotes(ns.map(x=>x.text)); setPeople(ps.map(x=>x.name));
    }).catch(()=>{});
  },[]);

  const filteredPhotos=useMemo(()=>{
    const q=query.trim().toLowerCase();
    if(!q)return photos;
    return photos.filter(p=>new Date(p.creationTime).toLocaleDateString().toLowerCase().includes(q) || p.filename.toLowerCase().includes(q));
  },[photos,query]);

  const grouped=useMemo(()=>{
    const map=new Map<string,Asset[]>();
    for(const p of filteredPhotos){ const key=new Date(p.creationTime).toLocaleDateString(undefined,{year:'numeric',month:'long',day:'numeric'}); if(!map.has(key)) map.set(key,[]); map.get(key)!.push(p); }
    return [...map.entries()];
  },[filteredPhotos]);

  async function addTask(text=task){
    const clean=text.trim(); if(!clean)return;
    const parsed=await createTaskFromText(clean); const db=await getDB();
    const r=await db.runAsync('INSERT INTO tasks (title,done) VALUES (?,0)',parsed.title); setTasks([{id:Number(r.lastInsertRowId),title:parsed.title,done:0},...tasks]); setTask('');
    if(notifications){ const date=new Date(Date.now()+60*1000); await scheduleTaskNotification('MyPhotoAI task',parsed.title,date).catch(()=>{}); }
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }

  async function addNote(){
    if(!note.trim())return; const db=await getDB(); await db.runAsync('INSERT INTO notes (text,createdAt) VALUES (?,?)',note.trim(),Date.now()); setNotes([note.trim(),...notes]); setNote('');
  }

  async function photoDescription(){
    if(!menuPhoto)return; setAiBusy(true); const d=await describePhoto(menuPhoto.uri); setAiBusy(false); Alert.alert('Local AI description',d); 
  }

  async function putPhotoOnTask(){
    if(!menuPhoto)return; const d=await describePhoto(menuPhoto.uri); await addTask(`Photo task: ${d}`); setMenuPhoto(null);
  }

  async function calendarAdd(){
    const start=new Date(); start.setHours(start.getHours()+1,0,0,0); const end=new Date(start.getTime()+60*60*1000);
    const id=await createCalendarEvent('MyPhotoAI task',start,end); Alert.alert(id?'Added to Calendar':'Calendar unavailable',id?'The event was added to your device calendar.':'Allow calendar access in Settings and try again.');
  }

  return <SafeAreaView style={s.safe}>
    <StatusBar barStyle="light-content" backgroundColor={C.bg}/>
    <View style={s.app}>
      <View style={s.content}>{tab==='photos'&&<Photos grouped={grouped} radius={radius} onSearch={()=>setSearchOpen(true)} onLongPress={p=>{Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);setMenuPhoto(p)}}/>}
      {tab==='tasks'&&<Tasks task={task} setTask={setTask} tasks={tasks} addTask={()=>addTask()} aiBusy={aiBusy} onAI={async()=>{setAiBusy(true);const x=await createTaskFromText('Plan something from my recent photos');setAiBusy(false);addTask(x.title)}}/>}
      {tab==='notes'&&<Notes note={note} setNote={setNote} notes={notes} addNote={addNote}/>} 
      {tab==='calendar'&&<CalendarScreen onAdd={calendarAdd}/>} 
      {tab==='settings'&&<Settings radius={radius} setRadius={setRadius} notifications={notifications} setNotifications={setNotifications} people={people} personName={personName} setPersonName={setPersonName} addPerson={async()=>{const n=personName.trim();if(!n)return;const db=await getDB();await db.runAsync('INSERT OR IGNORE INTO people (name) VALUES (?)',n);setPeople([...people.filter(x=>x!==n),n]);setPersonName('')}}/>}</View>
      <View style={s.nav}>{([['photos','images-outline','Photos'],['tasks','checkmark-circle-outline','Tasks'],['notes','document-text-outline','Notes'],['calendar','calendar-outline','Calendar'],['settings','settings-outline','Settings']] as const).map(([id,icon,label])=><Pressable key={id} onPress={()=>setTab(id)} style={[s.navItem,tab===id&&s.navActive]}><Ionicons name={icon as any} size={22} color={tab===id?'#fff':C.muted}/><Text style={[s.navText,tab===id&&{color:'#fff'}]}>{label}</Text></Pressable>)}</View>
      <Modal visible={searchOpen} transparent animationType="fade" onRequestClose={()=>setSearchOpen(false)}>
        <View style={s.modalRoot}><BlurView intensity={40} tint="dark" style={StyleSheet.absoluteFill}/><Pressable style={StyleSheet.absoluteFill} onPress={()=>setSearchOpen(false)}/>
          <View style={s.searchPanel}><View style={s.searchBox}><Ionicons name="search" size={21} color={C.muted}/><TextInput autoFocus value={query} onChangeText={setQuery} placeholder="Search photos…" placeholderTextColor={C.muted} style={s.searchInput}/><Pressable onPress={()=>{setQuery('');setSearchOpen(false)}}><Ionicons name="close-circle" size={22} color={C.muted}/></Pressable></View><Text style={s.searchHint}>Search by filename or date. All matching is local.</Text></View>
        </View>
      </Modal>
      <Modal visible={!!menuPhoto} transparent animationType="fade" onRequestClose={()=>setMenuPhoto(null)}>
        <View style={s.modalRoot}><BlurView intensity={35} tint="dark" style={StyleSheet.absoluteFill}/><Pressable style={StyleSheet.absoluteFill} onPress={()=>setMenuPhoto(null)}/>
          <View style={s.photoMenu}>{menuPhoto&&<Image source={{uri:menuPhoto.uri}} style={s.menuThumb}/>}<Text style={s.menuTitle}>Photo actions</Text>
            {[["share-outline","Share",async()=>{if(menuPhoto)await shareLocalFile(menuPhoto.uri).catch(()=>Alert.alert('Share unavailable','The system share sheet is not available on this device.'))}],["expand-outline","Fullscreen mode",()=>Alert.alert('Fullscreen','Fullscreen viewer will open in the production photo viewer.')],["information-circle-outline","Description",photoDescription],["checkmark-circle-outline","Put on a task",putPhotoOnTask],["settings-outline","Photo settings",()=>Alert.alert('Photo settings','Local photo settings will be stored with this photo.')]].map(([ico,label,fn])=><Pressable key={String(label)} style={s.menuRow} onPress={()=>fn()}><Ionicons name={ico as any} size={23} color="#fff"/><Text style={s.menuLabel}>{label}</Text><Ionicons name="chevron-forward" size={18} color={C.muted}/></Pressable>)}
            <Pressable style={[s.menuRow,s.cancel]} onPress={()=>setMenuPhoto(null)}><Text style={[s.menuLabel,{textAlign:'center',flex:1}]}>Cancel</Text></Pressable>
          </View>
        </View>
      </Modal>
    </View>
  </SafeAreaView>
}

function Photos({grouped,radius,onSearch,onLongPress}:{grouped:[string,Asset[]][],radius:number,onSearch:()=>void,onLongPress:(p:Asset)=>void}){ return <ScrollView contentContainerStyle={{paddingBottom:120}}><View style={s.header}><View style={s.rowBetween}><View><Text style={s.title}>Photos</Text><Text style={s.subtitle}>Private on this device</Text></View><Pressable onPress={onSearch} style={s.searchBtn}><Ionicons name="search" size={23} color="#fff"/></Pressable></View></View>{grouped.length?grouped.map(([date,arr])=><View key={date}><Text style={s.date}>{date}</Text><View style={s.grid}>{arr.map(p=><Pressable key={p.id} delayLongPress={450} onLongPress={()=>onLongPress(p)} style={[s.photo,{borderRadius:radius}]}><Image source={{uri:p.uri}} style={StyleSheet.absoluteFill}/><View style={s.aiBadge}><Text>✦</Text></View></Pressable>)}</View></View>):<View style={s.empty}><Ionicons name="images-outline" size={48} color={C.muted}/><Text style={s.emptyTitle}>No photos yet</Text><Text style={s.emptyText}>Allow photo access and your device library will appear here.</Text></View>}</ScrollView> }

function Tasks({task,setTask,tasks,addTask,aiBusy,onAI}:{task:string,setTask:(x:string)=>void,tasks:any[],addTask:()=>void,aiBusy:boolean,onAI:()=>void}){return <ScrollView contentContainerStyle={{paddingBottom:120}}><View style={s.header}><View style={s.rowBetween}><View><Text style={s.title}>Tasks</Text><Text style={s.subtitle}>Local tasks & reminders</Text></View><Pressable onPress={onAI} style={s.aiBtn}><Text style={{fontSize:20}}>✦</Text></Pressable></View></View><View style={s.card}><TextInput value={task} onChangeText={setTask} placeholder="Add a task…" placeholderTextColor={C.muted} style={s.input}/><Pressable onPress={addTask} style={s.primary}><Text style={s.primaryText}>{aiBusy?'Thinking…':'Add task'}</Text></Pressable></View>{tasks.map(t=><View style={s.listCard} key={t.id}><Ionicons name={t.done?'checkmark-circle':'ellipse-outline'} size={24} color={t.done?C.accent:C.muted}/><Text style={s.listText}>{t.title}</Text></View>)}</ScrollView>}

function Notes({note,setNote,notes,addNote}:{note:string,setNote:(x:string)=>void,notes:string[],addNote:()=>void}){return <ScrollView contentContainerStyle={{paddingBottom:120}}><View style={s.header}><Text style={s.title}>Sticky Notes</Text><Text style={s.subtitle}>Private notes stored locally</Text></View><View style={s.card}><TextInput multiline value={note} onChangeText={setNote} placeholder="Write a note…" placeholderTextColor={C.muted} style={[s.input,{minHeight:100,textAlignVertical:'top'}]}/><Pressable onPress={addNote} style={s.primary}><Text style={s.primaryText}>Save note</Text></Pressable></View>{notes.map((n,i)=><View style={s.note} key={i}><Ionicons name="push-outline" size={20} color={C.accent}/><Text style={s.noteText}>{n}</Text></View>)}</ScrollView>}

function CalendarScreen({onAdd}:{onAdd:()=>void}){const days=Array.from({length:30},(_,i)=>i+1);return <ScrollView contentContainerStyle={{paddingBottom:120}}><View style={s.header}><Text style={s.title}>Calendar</Text><Text style={s.subtitle}>Connected to your device calendar</Text></View><View style={s.calendar}><View style={s.rowBetween}><Text style={s.month}>October 2026</Text><Ionicons name="calendar" size={24} color={C.accent}/></View><View style={s.week}>{['S','M','T','W','T','F','S'].map(x=><Text style={s.weekText} key={x}>{x}</Text>)}</View><View style={s.days}>{days.map(d=><View key={d} style={[s.day,d===7&&s.today]}><Text style={{color:'#fff'}}>{d}</Text></View>)}</View></View><Pressable onPress={onAdd} style={s.primary}><Text style={s.primaryText}>Add test event to Calendar</Text></Pressable></ScrollView>}

function Settings({radius,setRadius,notifications,setNotifications,people,personName,setPersonName,addPerson}:{radius:number,setRadius:(x:number)=>void,notifications:boolean,setNotifications:(x:boolean)=>void,people:string[],personName:string,setPersonName:(x:string)=>void,addPerson:()=>void}){return <ScrollView contentContainerStyle={{paddingBottom:120}}><View style={s.header}><Text style={s.title}>Settings</Text><Text style={s.subtitle}>Privacy and app controls</Text></View><View style={s.card}><Text style={s.section}>Photos</Text><Text style={s.label}>Corner radius: {radius}px</Text><View style={s.sliderRow}>{[8,12,18,24,30].map(x=><Pressable key={x} onPress={()=>setRadius(x)} style={[s.radiusDot,{borderRadius:x/2},radius===x&&s.radiusSelected]}><View style={{width:20,height:20,borderRadius:x/2,backgroundColor:'#555'}}/></Pressable>)}</View></View><View style={s.card}><View style={s.rowBetween}><View><Text style={s.section}>Notifications</Text><Text style={s.helper}>Task and calendar reminders</Text></View><Switch value={notifications} onValueChange={setNotifications}/></View></View><View style={s.card}><Text style={s.section}>People</Text><Text style={s.helper}>AI face recognition is designed to run locally. Names are stored only on this device.</Text><TextInput value={personName} onChangeText={setPersonName} placeholder="Name a person…" placeholderTextColor={C.muted} style={[s.input,{marginTop:12}]}/><Pressable onPress={addPerson} style={s.secondary}><Ionicons name="person-add-outline" size={20} color="#fff"/><Text style={{color:'#fff',fontWeight:'650'}}>Save face name</Text></Pressable>{people.map(x=><View key={x} style={s.personRow}><Ionicons name="person-circle-outline" size={22} color={C.accent}/><Text style={{color:'#fff',flex:1}}>{x}</Text></View>)}</View><View style={s.privacy}><Ionicons name="lock-closed" size={18} color={C.accent}/><Text style={s.helper}>Local-first: photos, tasks, notes and settings are stored on the device. No account is required.</Text></View></ScrollView>}

const s=StyleSheet.create({safe:{flex:1,backgroundColor:C.bg},app:{flex:1,backgroundColor:C.bg},content:{flex:1},header:{paddingTop:18,paddingHorizontal:18,paddingBottom:12},title:{fontSize:31,fontWeight:'800',letterSpacing:-1,color:C.text},subtitle:{marginTop:5,color:C.muted,fontSize:13},date:{fontSize:17,fontWeight:'700',color:C.text,paddingHorizontal:10,paddingTop:14,paddingBottom:8},grid:{flexDirection:'row',flexWrap:'wrap',gap:3,paddingHorizontal:3},photo:{width:'32.8%',aspectRatio:1,overflow:'hidden',backgroundColor:'#17181c'},aiBadge:{position:'absolute',right:6,top:6,width:24,height:24,borderRadius:8,backgroundColor:'rgba(0,0,0,.45)',alignItems:'center',justifyContent:'center'},empty:{padding:80,alignItems:'center'},emptyTitle:{color:'#fff',fontSize:20,fontWeight:'750',marginTop:12},emptyText:{color:C.muted,textAlign:'center',marginTop:7,lineHeight:20},nav:{position:'absolute',bottom:8,left:10,right:10,height:68,borderRadius:25,borderWidth:1,borderColor:C.line,backgroundColor:'rgba(28,29,34,.82)',flexDirection:'row',padding:5},navItem:{flex:1,alignItems:'center',justifyContent:'center',borderRadius:19},navActive:{backgroundColor:'rgba(255,255,255,.09)'},navText:{fontSize:10,fontWeight:'650',color:C.muted,marginTop:3},rowBetween:{flexDirection:'row',justifyContent:'space-between',alignItems:'center'},row:{flexDirection:'row',alignItems:'center'},aiBtn:{width:48,height:48,borderRadius:17,backgroundColor:'rgba(138,180,255,.16)',borderWidth:1,borderColor:'rgba(138,180,255,.3)',alignItems:'center',justifyContent:'center'},card:{marginHorizontal:14,marginVertical:8,padding:14,borderRadius:22,borderWidth:1,borderColor:C.line,backgroundColor:'rgba(30,31,36,.82)'},input:{backgroundColor:'rgba(255,255,255,.06)',borderWidth:1,borderColor:C.line,borderRadius:16,color:'#fff',paddingHorizontal:14,paddingVertical:12,marginBottom:10},primary:{backgroundColor:'#f3f4f6',borderRadius:17,paddingVertical:14,alignItems:'center'},primaryText:{color:'#111216',fontWeight:'750'},listCard:{marginHorizontal:14,marginVertical:4,padding:16,borderRadius:18,borderWidth:1,borderColor:C.line,backgroundColor:'rgba(255,255,255,.045)',flexDirection:'row',alignItems:'center',gap:12},listText:{color:'#fff',fontSize:15,flex:1},note:{marginHorizontal:14,marginVertical:5,padding:16,borderRadius:18,backgroundColor:'#d7c36a',flexDirection:'row',gap:10},noteText:{color:'#1c1b16',fontSize:15,flex:1},calendar:{margin:14,padding:16,borderRadius:24,borderWidth:1,borderColor:C.line,backgroundColor:'rgba(30,31,36,.82)'},month:{color:'#fff',fontSize:20,fontWeight:'750'},week:{flexDirection:'row',marginTop:20},weekText:{flex:1,textAlign:'center',color:C.muted,fontSize:12,fontWeight:'700'},days:{flexDirection:'row',flexWrap:'wrap',marginTop:10},day:{width:'14.285%',height:44,alignItems:'center',justifyContent:'center',borderRadius:14},today:{backgroundColor:'rgba(138,180,255,.22)',borderWidth:1,borderColor:'rgba(138,180,255,.35)'},section:{color:'#fff',fontSize:16,fontWeight:'750',marginBottom:5},label:{color:C.muted,fontSize:13},helper:{color:C.muted,lineHeight:20,flex:1},sliderRow:{flexDirection:'row',gap:12,marginTop:12},radiusDot:{width:38,height:38,backgroundColor:'rgba(255,255,255,.05)',alignItems:'center',justifyContent:'center',borderWidth:1,borderColor:C.line},radiusSelected:{borderColor:C.accent,backgroundColor:'rgba(138,180,255,.15)'},secondary:{marginTop:14,borderRadius:16,padding:14,backgroundColor:'rgba(255,255,255,.06)',flexDirection:'row',alignItems:'center',gap:8},personRow:{flexDirection:'row',alignItems:'center',gap:10,paddingVertical:9,borderTopWidth:1,borderTopColor:C.line,marginTop:8},privacy:{margin:14,padding:16,borderRadius:18,borderWidth:1,borderColor:'rgba(138,180,255,.18)',backgroundColor:'rgba(138,180,255,.07)',flexDirection:'row',gap:10},modalRoot:{flex:1,justifyContent:'flex-end'},photoMenu:{margin:10,padding:10,paddingTop:16,borderRadius:28,borderWidth:1,borderColor:'rgba(255,255,255,.12)',backgroundColor:'rgba(22,23,27,.92)',overflow:'hidden'},searchPanel:{margin:12,padding:12,borderRadius:24,borderWidth:1,borderColor:C.line,backgroundColor:'rgba(22,23,27,.92)'},searchBox:{height:54,borderRadius:17,backgroundColor:'rgba(255,255,255,.07)',flexDirection:'row',alignItems:'center',paddingHorizontal:14,gap:10},searchInput:{flex:1,color:'#fff',fontSize:16},searchHint:{color:C.muted,fontSize:12,padding:10,lineHeight:18},searchBtn:{width:48,height:48,borderRadius:17,backgroundColor:'rgba(255,255,255,.08)',alignItems:'center',justifyContent:'center'},menuThumb:{width:58,height:58,borderRadius:16,alignSelf:'center',marginBottom:10},menuTitle:{color:C.muted,fontSize:12,fontWeight:'700',textTransform:'uppercase',letterSpacing:1,padding:6},menuRow:{minHeight:56,paddingHorizontal:10,borderRadius:16,flexDirection:'row',alignItems:'center',gap:13},menuLabel:{color:'#fff',fontSize:16,fontWeight:'650',flex:1},cancel:{marginTop:5,backgroundColor:'rgba(255,255,255,.06)'}});
