from scapy.all import sniff, IP, TCP, UDP, Raw, DNS, DNSRR
try:
    from scapy.layers.tls.all import TLS
    from scapy.layers.http import HTTPRequest
except ImportError:
    pass
import requests
import time
import socket
import threading

API_URL = "http://localhost:5000/api/analyze"
API_KEY = "6c8a35703066cf5c88efc28f1ef4fbf0091a48229bb0f68575558322136be4b4"

headers = {
    "Content-Type": "application/json",
    "x-api-key": API_KEY
}

packet_times = {}
# Local mapping for DNS results
dns_mapping = {} # ip -> domain

def get_protocol(pkt):
    if pkt.haslayer(TCP):
        return "TCP"
    if pkt.haslayer(UDP):
        return "UDP"
    return "OTHER"

def handle_dns(pkt):
    """Capture DNS responses to build local IP-domain map"""
    if pkt.haslayer(DNS) and pkt.getlayer(DNS).qr == 1: # DNS Response
        try:
            domain = pkt.getlayer(DNS).qd.qname.decode().rstrip('.')
            for i in range(pkt.ancount):
                res = pkt.an[i]
                if res.type == 1: # A record (IPv4)
                    ip = res.rdata
                    dns_mapping[ip] = domain
                    # print(f"[DNS] Mapped {ip} -> {domain}")
        except:
            pass

def extract_domain(pkt):
    """Extract domain from TLS SNI, HTTP Host header, or local DNS map"""
    try:
        # 1. Try TLS SNI
        if pkt.haslayer('TLS') and hasattr(pkt['TLS'], 'msg'):
            for msg in pkt['TLS'].msg:
                if hasattr(msg, 'handshake') and hasattr(msg.handshake, 'extensions'):
                    for ext in msg.handshake.extensions:
                        if hasattr(ext, 'server_names'):
                            for name in ext.server_names:
                                return name.servername.decode(), "SNI"
        
        # 2. Try HTTP Host header
        if pkt.haslayer('HTTPRequest'):
            host = pkt['HTTPRequest'].Host.decode()
            return host, "HTTP"
            
        # 3. Try Local DNS Map
        dst_ip = pkt[IP].dst
        if dst_ip in dns_mapping:
            return dns_mapping[dst_ip], "DNS-Cache"

        # 4. Fallback to reverse DNS
        try:
            domain = socket.gethostbyaddr(dst_ip)[0]
            return domain, "DNS-Reverse"
        except:
            return "Unknown", "Unknown"
    except:
        return "Unknown", "Unknown"

def handle_packet(pkt):
    if not pkt.haslayer(IP):
        return

    protocol = get_protocol(pkt)
    src_port = 0
    dst_port = 0
    flags = 0

    if pkt.haslayer(TCP):
        src_port = pkt[TCP].sport
        dst_port = pkt[TCP].dport
        flags = int(pkt[TCP].flags)
    elif pkt.haslayer(UDP):
        src_port = pkt[UDP].sport
        dst_port = pkt[UDP].dport

    src_ip = pkt[IP].src
    dst_ip = pkt[IP].dst
    now = time.time()
    
    # Debounce logic
    global reported_times
    if 'reported_times' not in globals():
        reported_times = {}
        
    if now - reported_times.get(dst_ip, 0) < 5:
        return
    reported_times[dst_ip] = now

    key = f"{src_ip}-{dst_ip}-{src_port}-{dst_port}"
    duration = now - packet_times.get(key, now)
    packet_times[key] = now

    real_domain, source = extract_domain(pkt)

    payload = {
        "protocol": protocol,
        "src_port": src_port,
        "dst_port": dst_port,
        "duration": round(duration, 4),
        "bytes_sent": len(pkt),
        "bytes_received": 0,
        "src_ip": src_ip,
        "dst_ip": dst_ip,
        "flags": flags,
        "real_domain": real_domain,
        "detection_source": source
    }

    try:
        res = requests.post(API_URL, json=payload, headers=headers, timeout=5)
        if res.status_code == 200:
            domain_info = f" ({real_domain})" if real_domain != "Unknown" else ""
            print(f"[{time.strftime('%X')}] 🌐 {protocol} -> {dst_ip}:{dst_port}{domain_info} [{source}]")
        else:
            print(f"[{time.strftime('%X')}] ❌ Backend Error: {res.status_code}")
    except Exception as e:
        print("Backend send error:", e)

def start_dns_sniff():
    print("Starting DNS background listener...")
    sniff(prn=handle_dns, filter="udp port 53", store=0)

if __name__ == "__main__":
    # Start DNS sniffing in a background thread
    dns_thread = threading.Thread(target=start_dns_sniff, daemon=True)
    dns_thread.start()

    print("Starting enhanced packet capture (SNI/HTTP/DNS/DNS-Cache)...")
    sniff(prn=handle_packet, store=False, filter="tcp port 80 or tcp port 443", iface=None)
